import unittest
from unittest.mock import patch

import route_feedback


REPOSITORY = "org/repo"
ISSUES = f"/repos/{REPOSITORY}/issues"
ISSUE = f"{ISSUES}/42"
COMMENTS = f"{ISSUE}/comments"
ALPHA = "example.alpha"
BETA = "example.beta"
MAINTAINERS = {ALPHA: "Alice", BETA: "Bob"}
HANDLED = "<!-- daozai-plugin-feedback -->"
CLOSE_HELP = "<!-- daozai-feedback-close-help -->"
NOTICE = "@Alice 有一条插件反馈，请查看本问题单。"
CLOSED = {"state": "closed", "state_reason": "completed"}


def feedback(plugin=ALPHA, **changes):
    return {
        "number": 42, "node_id": "issue-node", "state": "open",
        "title": "[问题或建议] 示例", "body": f"插件 ID：{plugin}\n\n问题说明",
        "user": {"login": "Reporter", "type": "User"},
        **changes,
    }


def notification(*, plugin=ALPHA, login="github-actions[bot]", app="github-actions", kind="Bot"):
    binding = f"\n<!-- daozai-feedback-plugin: {plugin} -->" if plugin else ""
    return {
        "body": HANDLED + binding + "\n" + NOTICE,
        "user": {"login": login, "type": kind},
        "performed_via_github_app": {"slug": app},
    }


def unedited_history(issue, **changes):
    return {"data": {"node": {
        "body": issue["body"], "lastEditedAt": None, "userContentEdits": {"totalCount": 0},
        **changes,
    }}}


class RouteFeedbackTests(unittest.TestCase):
    def run_with_api(self, run, *, issue, current=None, comment_pages=None, issue_pages=None,
                     edit_history=None):
        writes = []
        reads = []

        def api(path, token, data=None, *, method=None):
            self.assertEqual(token, "test-token")
            if path == "/graphql":
                self.assertIsNotNone(edit_history, "只有兼容旧通知时才可查编辑历史")
                self.assertEqual(data["variables"]["id"], "issue-node")
                reads.append(path)
                return edit_history
            if data is not None:
                writes.append((method or "POST", path, data))
                return {}
            reads.append(path)
            if path == ISSUE:
                return issue if current is None else current
            if path.startswith(f"{COMMENTS}?per_page=100&page="):
                return (comment_pages or {}).get(int(path.split("=")[-1]), [])
            if path.startswith(f"{ISSUES}?state=open&per_page=100&page="):
                return (issue_pages or {}).get(int(path.split("=")[-1]), [])
            self.fail(f"非预期请求：{path}")

        with patch.object(route_feedback, "api", side_effect=api):
            run()
        return writes, reads

    def run_event(self, *, issue=None, current=None, author="Alice", kind="User", action="created",
                  body="/close", comment_pages=None, edit_history=None, maintainers=MAINTAINERS,
                  sender=None):
        issue = feedback() if issue is None else issue
        event = {"action": action, "issue": issue, "sender": {"login": sender or author, "type": kind}}
        if action != "opened":
            event["comment"] = {"body": body, "user": {"login": author, "type": kind}}
        return self.run_with_api(
            lambda: route_feedback.handle_event(event, REPOSITORY, maintainers, "test-token"),
            issue=issue, current=current, comment_pages=comment_pages, edit_history=edit_history,
        )

    def run_backfill(self, *, issue=None, issue_pages=None, maintainers=MAINTAINERS, **options):
        issue = feedback() if issue is None else issue
        if issue_pages is None:
            issue_pages = {1: [issue]}
        return self.run_with_api(
            lambda: route_feedback.backfill_close_help(REPOSITORY, maintainers, "test-token"),
            issue=issue, issue_pages=issue_pages, **options,
        )

    def test_opened_feedback_records_registered_plugin_and_explains_command(self):
        writes, _ = self.run_event(action="opened")
        self.assertEqual(len(writes), 1)
        method, path, payload = writes[0]
        self.assertEqual((method, path), ("POST", COMMENTS))
        self.assertEqual(payload["body"].splitlines()[:2], [
            HANDLED, f"<!-- daozai-feedback-plugin: {ALPHA} -->",
        ])
        self.assertIn("@Alice", payload["body"])
        self.assertIn("/close", payload["body"])

    def test_installation_and_unregistered_feedback_only_notify_repository_owner(self):
        for issue in (feedback(title="[安装与更新] 示例"), feedback("example.unregistered")):
            with self.subTest(issue=issue["title"], body=issue["body"]):
                writes, _ = self.run_event(action="opened", issue=issue)
                self.assertEqual(len(writes), 1)
                method, path, payload = writes[0]
                self.assertEqual((method, path), ("POST", COMMENTS))
                self.assertIn("@org", payload["body"])
                self.assertNotIn("daozai-feedback-plugin:", payload["body"])
                self.assertNotIn("/close", payload["body"])

    def test_existing_notification_prevents_duplicate(self):
        writes, _ = self.run_event(action="opened", comment_pages={1: [notification(plugin=None)]})
        self.assertEqual(writes, [])

    def test_registered_maintainer_closes_own_plugin_feedback(self):
        writes, reads = self.run_event(author="aLiCe", comment_pages={1: [notification()]})
        self.assertEqual(writes, [("PATCH", ISSUE, CLOSED)])
        self.assertIn(ISSUE, reads)

    def test_searches_next_page_for_notification(self):
        ordinary_comments = [{"body": "普通讨论", "user": {"login": "Reporter"}}] * 100
        writes, _ = self.run_event(comment_pages={1: ordinary_comments, 2: [notification()]})
        self.assertEqual(writes, [("PATCH", ISSUE, CLOSED)])

    def test_close_command_uses_current_maintainer_registration(self):
        for actor, expected in (("Alice", []), ("NewMaintainer", [("PATCH", ISSUE, CLOSED)])):
            with self.subTest(actor=actor):
                writes, _ = self.run_event(author=actor, maintainers={ALPHA: "NewMaintainer"},
                                           comment_pages={1: [notification()]})
                self.assertEqual(writes, expected)

    def test_other_plugin_author_reporter_and_repository_owner_cannot_close_by_command(self):
        for actor in ("Bob", "Reporter", "org"):
            with self.subTest(actor=actor):
                writes, _ = self.run_event(author=actor, comment_pages={1: [notification()]})
                self.assertEqual(writes, [])

    def test_close_authentication_checks_comment_author(self):
        writes, _ = self.run_event(author="Reporter", sender="Alice", comment_pages={1: [notification()]})
        self.assertEqual(writes, [])

    def test_issue_body_does_not_override_plugin_binding(self):
        writes, _ = self.run_event(issue=feedback(BETA), author="Bob",
                                   comment_pages={1: [notification()]})
        self.assertEqual(writes, [])

    def test_notification_requires_github_actions_author_and_app(self):
        attempts = (
            notification(login="Alice"), notification(kind="User"),
            notification(app="different-app"), {**notification(), "body": "> " + notification()["body"]},
        )
        for item in attempts:
            with self.subTest(item=item):
                writes, _ = self.run_event(comment_pages={1: [item]})
                self.assertEqual(writes, [])

    def test_old_notification_with_verified_unedited_body_can_close(self):
        issue = feedback()
        writes, reads = self.run_event(issue=issue, comment_pages={1: [notification(plugin=None)]},
                                       edit_history=unedited_history(issue))
        self.assertIn("/graphql", reads)
        self.assertEqual(writes, [("PATCH", ISSUE, CLOSED)])

    def test_old_notification_needs_intact_body_and_edit_history(self):
        original = {"body": feedback()["body"], "lastEditedAt": None, "userContentEdits": {"totalCount": 0}}
        histories = (
            {"data": {"node": {**original, "lastEditedAt": "2026-11-26T00:00:00Z"}}},
            {"data": {"node": {**original, "userContentEdits": {"totalCount": 1}}}},
            {"data": {"node": {**original, "body": feedback(BETA)["body"]}}},
            {"data": {"node": {"body": original["body"], "userContentEdits": {"totalCount": 0}}}},
            {"errors": [{"message": "未能读取编辑历史"}]},
        )
        for history in histories:
            with self.subTest(history=history):
                writes, _ = self.run_event(comment_pages={1: [notification(plugin=None)]},
                                           edit_history=history)
                self.assertEqual(writes, [])

    def test_only_open_ordinary_plugin_issues_can_close(self):
        cases = (
            feedback(title="[安装与更新] 示例"), feedback(title="[安全或隐私] 示例"),
            feedback(body=f"插件 ID：{ALPHA}\n## 安全或隐私"),
            feedback(body=f"插件 ID：{ALPHA}\n插件 ID：{BETA}"),
            feedback(pull_request={}), feedback(state="closed"),
            feedback("example.unregistered"),
        )
        for issue in cases:
            with self.subTest(issue=issue):
                writes, _ = self.run_event(issue=issue, comment_pages={1: [notification()]})
                self.assertEqual(writes, [])

    def test_close_rechecks_open_state_and_classification(self):
        for current in (feedback(state="closed"), feedback(title="[安装与更新] 示例"), feedback(BETA)):
            with self.subTest(current=current):
                writes, reads = self.run_event(current=current, comment_pages={1: [notification()]})
                self.assertIn(ISSUE, reads)
                self.assertEqual(writes, [])

    def test_only_exact_human_comment_created_command_runs(self):
        cases = (
            {"action": "edited"}, {"action": "transferred"}, {"kind": "Bot"},
            {"body": "> /close"}, {"body": "/close #43"}, {"body": "/close "},
            {"body": "已修复，/close"},
        )
        for changes in cases:
            with self.subTest(changes=changes):
                writes, _ = self.run_event(comment_pages={1: [notification()]}, **changes)
                self.assertEqual(writes, [])

    def test_backfill_sends_instructions_for_verified_legacy_feedback(self):
        issue = feedback()
        other_issues = [feedback(pull_request={})] * 100
        fake_help = {**notification(login="Reporter", kind="User"), "body": CLOSE_HELP}
        writes, reads = self.run_backfill(
            issue=issue, issue_pages={1: other_issues, 2: [issue]},
            comment_pages={1: [notification(plugin=None), fake_help]},
            edit_history=unedited_history(issue),
        )
        self.assertEqual(len(writes), 1)
        method, path, payload = writes[0]
        self.assertEqual((method, path), ("POST", COMMENTS))
        self.assertEqual(payload["body"].splitlines()[0], CLOSE_HELP)
        self.assertIn("@Alice", payload["body"])
        self.assertIn("/close", payload["body"])
        self.assertIn(f"{ISSUES}?state=open&per_page=100&page=2", reads)
        self.assertIn(ISSUE, reads)
        self.assertIn("/graphql", reads)

    def test_backfill_skips_existing_genuine_help_on_a_later_page(self):
        help_comment = {**notification(), "body": f"{CLOSE_HELP}\n@Alice 请评论 /close。"}
        ordinary = [{"body": "普通讨论", "user": {"login": "Reporter"}}] * 99
        writes, _ = self.run_backfill(
            comment_pages={1: [notification(plugin=None), *ordinary], 2: [help_comment]},
            edit_history=unedited_history(feedback()),
        )
        self.assertEqual(writes, [])

    def test_backfill_skips_new_or_untrusted_notifications(self):
        current_help = {**notification(), "body": notification()["body"] + "\n可评论 /close。"}
        for comment_pages in (
            {1: [current_help]}, {1: [notification(plugin=None, app="different-app")]}, {},
        ):
            with self.subTest(comment_pages=comment_pages):
                writes, _ = self.run_backfill(comment_pages=comment_pages)
                self.assertEqual(writes, [])

    def test_backfill_skips_nonfeedback_and_issues_closed_since_listing(self):
        for changes in (
            {"issue": feedback(state="closed")}, {"current": feedback(state="closed")},
            {"issue": feedback(title="[安装与更新] 示例")}, {"issue": feedback(title="[安全或隐私] 示例")},
            {"issue": feedback(body=f"插件 ID：{ALPHA}\n## 安全或隐私")},
            {"issue": feedback("example.unregistered")}, {"issue": feedback(pull_request={})},
        ):
            with self.subTest(changes=changes):
                writes, _ = self.run_backfill(comment_pages={1: [notification(plugin=None)]}, **changes)
                self.assertEqual(writes, [])

    def test_backfill_skips_edited_feedback_and_changed_maintainer(self):
        issue = feedback()
        for changes in (
            {"edit_history": unedited_history(issue, lastEditedAt="2026-11-26T00:00:00Z")},
            {"edit_history": unedited_history(issue, userContentEdits={"totalCount": 1})},
            {"maintainers": {ALPHA: "NewMaintainer"}, "edit_history": unedited_history(issue)},
        ):
            with self.subTest(changes=changes):
                writes, _ = self.run_backfill(issue=issue, comment_pages={1: [notification(plugin=None)]},
                                               **changes)
                self.assertEqual(writes, [])


if __name__ == "__main__":
    unittest.main()

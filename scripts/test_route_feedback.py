import unittest
from unittest.mock import patch

import route_feedback


REPOSITORY = "org/repo"
ISSUE = f"/repos/{REPOSITORY}/issues/42"
COMMENTS = f"{ISSUE}/comments"
ALPHA = "example.alpha"
BETA = "example.beta"
MAINTAINERS = {ALPHA: "Alice", BETA: "Bob"}
HANDLED = "<!-- daozai-plugin-feedback -->"
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


class RouteFeedbackTests(unittest.TestCase):
    def run_event(self, *, issue=None, current=None, author="Alice", kind="User", action="created",
                  body="/close", comment_pages=None, edit_history=None, maintainers=MAINTAINERS,
                  sender=None):
        issue = feedback() if issue is None else issue
        event = {"action": action, "issue": issue, "sender": {"login": sender or author, "type": kind}}
        if action != "opened":
            event["comment"] = {"body": body, "user": {"login": author, "type": kind}}
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
            self.fail(f"非预期请求：{path}")

        with patch.object(route_feedback, "api", side_effect=api):
            route_feedback.handle_event(event, REPOSITORY, maintainers, "test-token")
        return writes, reads

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
        history = {"data": {"node": {
            "body": issue["body"], "lastEditedAt": None, "userContentEdits": {"totalCount": 0},
        }}}
        writes, reads = self.run_event(issue=issue, comment_pages={1: [notification(plugin=None)]},
                                       edit_history=history)
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


if __name__ == "__main__":
    unittest.main()

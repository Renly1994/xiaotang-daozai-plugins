"""通知插件维护者，核验登记后关闭对应的公开反馈。"""

import json
import os
import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ID_LINE = re.compile(r"^插件 ID[：:][ \t]*([a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+)[ \t]*$", re.M)
LOGIN = re.compile(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
HANDLED = "<!-- daozai-plugin-feedback -->"
BINDING = "<!-- daozai-feedback-plugin: {} -->"
CLOSE_HELP = "<!-- daozai-feedback-close-help -->"
CLOSE_COMMAND = "/close"
NOTICE = "@{} 有一条插件反馈，请查看本问题单。"
CLOSE_HINT = f"处理完成后，登记维护者可单独评论 `{CLOSE_COMMAND}` 关闭这条反馈。"


def route(issue, maintainers, owner):
    title = issue.get("title") or ""
    body = (issue.get("body") or "").replace("\r\n", "\n")
    if title.startswith("[安全或隐私]") or re.search(r"^##[ \t]+安全或隐私[ \t]*$", body, re.M):
        return None, None
    matches = ID_LINE.findall(body)
    if len(matches) != 1 or len(matches[0]) > 64:
        return None, None
    plugin = matches[0]
    if title.startswith("[安装与更新]") or plugin not in maintainers:
        plugin = None
    login = maintainers[plugin] if plugin else owner
    if not isinstance(login, str) or len(login) > 39 or not LOGIN.fullmatch(login):
        raise ValueError("维护者账号格式无效")
    return plugin, login


def api(path, token, data=None, *, method=None):
    request = Request(
        "https://api.github.com" + path,
        data=json.dumps(data, ensure_ascii=False).encode("utf-8") if data is not None else None,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "daozai-plugin-feedback",
        },
    )
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def pages(path, token):
    separator = "&" if "?" in path else "?"
    page = 1
    while True:
        items = api(f"{path}{separator}per_page=100&page={page}", token)
        yield from items
        if len(items) < 100:
            return
        page += 1


def feedback_comments(path, token):
    for comment in pages(path, token):
        user = comment.get("user") or {}
        app = comment.get("performed_via_github_app") or {}
        lines = (comment.get("body") or "").splitlines()
        if (user.get("login") == "github-actions[bot]" and user.get("type") == "Bot"
                and app.get("slug") == "github-actions"
                and lines and lines[0] in (HANDLED, CLOSE_HELP)):
            yield lines


def routing_comment(comments):
    return next((lines for lines in comments if lines[0] == HANDLED), None)


def legacy_notice(recorded, login):
    return recorded is not None and len(recorded) == 2 and recorded[1].casefold() == NOTICE.format(login).casefold()


def unedited_body(issue, token):
    node_id = issue.get("node_id")
    if not node_id:
        return False
    query = """query ($id: ID!) {
      node(id: $id) {
        ... on Issue { body lastEditedAt userContentEdits(first: 1) { totalCount } }
      }
    }"""
    value = api("/graphql", token, {"query": query, "variables": {"id": node_id}})
    node = (value.get("data") or {}).get("node") or {}
    return (not value.get("errors") and node.get("body") == issue.get("body")
            and "lastEditedAt" in node and node["lastEditedAt"] is None
            and (node.get("userContentEdits") or {}).get("totalCount") == 0)


def handle_event(event, repository, maintainers, token):
    issue = event["issue"]
    action = event.get("action")
    if "pull_request" in issue or action not in ("opened", "created"):
        return
    owner, _ = repository.split("/", 1)
    plugin, login = route(issue, maintainers, owner)
    if not login:
        return

    path = f"/repos/{repository}/issues/{int(issue['number'])}"
    comments_path = f"{path}/comments"
    if action == "opened":
        if routing_comment(feedback_comments(comments_path, token)) is None:
            lines = [HANDLED, NOTICE.format(login)]
            if plugin:
                lines.insert(1, BINDING.format(plugin))
                lines.extend(["", CLOSE_HINT])
            api(comments_path, token, {"body": "\n".join(lines)})
        return

    comment = event.get("comment") or {}
    author = comment.get("user") or {}
    if (not plugin or issue.get("state") != "open" or comment.get("body") != CLOSE_COMMAND
            or author.get("type") != "User" or (author.get("login") or "").casefold() != login.casefold()):
        return
    recorded = routing_comment(feedback_comments(comments_path, token))
    if recorded is None:
        return
    current = api(path, token)
    if current.get("state") != "open" or route(current, maintainers, owner) != (plugin, login):
        return
    bound = recorded[1:2] == [BINDING.format(plugin)]
    if bound or (legacy_notice(recorded, login) and unedited_body(current, token)):
        api(path, token, {"state": "closed", "state_reason": "completed"}, method="PATCH")


def backfill_close_help(repository, maintainers, token):
    owner, _ = repository.split("/", 1)
    issues_path = f"/repos/{repository}/issues"
    sent = 0
    for issue in pages(f"{issues_path}?state=open", token):
        if issue.get("state") != "open" or "pull_request" in issue:
            continue
        plugin, login = route(issue, maintainers, owner)
        if not plugin:
            continue
        path = f"{issues_path}/{int(issue['number'])}"
        comments_path = f"{path}/comments"
        comments = list(feedback_comments(comments_path, token))
        if any(lines[0] == CLOSE_HELP for lines in comments) or not legacy_notice(routing_comment(comments), login):
            continue
        current = api(path, token)
        if (current.get("state") == "open" and route(current, maintainers, owner) == (plugin, login)
                and unedited_body(current, token)):
            api(comments_path, token, {"body": f"{CLOSE_HELP}\n@{login} {CLOSE_HINT}"})
            sent += 1
    return sent


def main():
    repository = os.environ["GITHUB_REPOSITORY"]
    maintainers = json.loads((ROOT / ".github/plugin-maintainers.json").read_text(encoding="utf-8"))
    token = os.environ["GITHUB_TOKEN"]
    if os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch":
        sent = backfill_close_help(repository, maintainers, token)
        print(f"已为 {sent} 条旧反馈补发关闭说明。")
        return
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    handle_event(event, repository, maintainers, token)


if __name__ == "__main__":
    main()

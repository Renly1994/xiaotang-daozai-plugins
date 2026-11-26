import json

import pytest

import publish
import submission
from test_plugin_approval import COVER


ID = "example.canvas"
KIB = 1024
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'
WGSL = b"fn material(i: MaterialIn) -> vec4<f32> { return vec4<f32>(1.0); }"


def status_manifest(**fields):
    return {
        "id": ID, "name": "画布", "author": "测试", "version": "1.0.0",
        "api": 1, "runtime": "js", "owner": "status", "entry": "main.js",
        "cover": "cover.png", "permissions": {}, "capabilities": ["status.page"],
        **fields,
    }


@pytest.fixture
def plugin(tmp_path):
    def git(*args):
        return submission.git(tmp_path, *args)

    git("init", "--quiet")
    git("config", "user.name", "测试")
    git("config", "user.email", "author@example.test")
    git("config", "commit.gpgsign", "false")
    git("commit", "--quiet", "--allow-empty", "-m", "初始化")
    base = git("rev-parse", "HEAD").decode().strip()

    def submit(*, fields=None, extras=None, check_pr=False):
        manifest = status_manifest(**(fields or {}))
        files = {"plugin.json": json.dumps(manifest).encode(), "cover.png": COVER}
        if manifest["runtime"] == "js":
            files["main.js"] = b"function refresh() { return {}; }"
        files.update(extras or {})
        directory = tmp_path / "plugins" / ID
        for name, contents in files.items():
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(contents)
        git("add", "--all")
        git("commit", "--quiet", "-m", "插件投稿")
        if check_pr:
            assert submission.check_pull_request(base, "HEAD") == {ID}
        return submission.read_plugin(tmp_path, "HEAD", ID)

    return submit


def test_status_plugin_accepts_current_capabilities_and_nested_assets(plugin, monkeypatch, tmp_path):
    monkeypatch.setattr(submission, "ROOT", tmp_path)
    _, files = plugin(
        fields={
            "capabilities": ["status.page", "status.canvas", "island.pinned", "action", "event",
                             "notice", "timer", "storage", "settings", "card"],
            "statusLayout": {"components": [{"type": "canvas"}, {"type": "fields"}]},
            "network": {"hosts": ["www.example.test"]},
            "data": ["日历.json"], "timezones": True, "events": ["focus.finished"],
        },
        extras={"日历.json": b'{"days": []}', "icons/reference.svg": SVG, "picture.png": COVER,
                "fixtures/states/empty.json": b"{}", "fixtures/sample.png": COVER,
                "TESTING.md": b"tests", "LICENSE": b"MIT",
                "README.md": b"readme"},
        check_pr=True,
    )
    assert set(files) == {"plugin.json", "main.js", "cover.png", "日历.json", "icons/reference.svg", "picture.png"}


def material_manifest(**fields):
    return {
        "name": "材质", "runtime": "material", "owner": "appearance", "entry": "sample.wgsl",
        "permissions": {"screen.backdrop": True}, "dataVersion": 1,
        "capabilities": ["appearance.material"], "settings": [],
        "material": {"controls": True, "spring": {"stiffness": 1, "damping": 0.5}},
        **fields,
    }


def test_accepts_material_source_submission(plugin, monkeypatch, tmp_path):
    monkeypatch.setattr(submission, "ROOT", tmp_path)
    manifest, files = plugin(fields=material_manifest(
        capabilities=["settings", "appearance.material"],
        settings=[{"key": "blur", "label": "模糊", "type": "number",
                   "default": "1", "min": 0, "max": 2, "step": 1}],
    ), extras={"sample.wgsl": WGSL, "README.md": b"readme"}, check_pr=True)
    assert manifest["runtime"] == "material"
    assert set(files) == {"plugin.json", "cover.png", "sample.wgsl"}
    assert files["sample.wgsl"] == WGSL


@pytest.mark.parametrize("fields,source,extras,error", [
    ({"entry": "nested/sample.wgsl"}, WGSL, {}, "包根目录"),
    ({"owner": "status"}, WGSL, {}, "清单 owner"),
    ({"permissions": {"screen.backdrop": 1}}, WGSL, {}, "screen.backdrop"),
    ({"permissions": {"screen.backdrop": True, "source.read": "https"}}, WGSL, {}, "screen.backdrop"),
    ({"settings": [{"type": "text"}]}, WGSL, {}, "数字设置"),
    ({"data": ["input.json"]}, WGSL, {}, "脚本清单字段"),
    ({}, b" ", {}, "WGSL.*不能为空"),
    ({}, b"\xff", {}, "UTF-8"),
    ({}, b"x" * (64 * KIB + 1), {}, "超出大小限制"),
    ({}, WGSL, {"another.wgsl": WGSL}, "未支持的文件"),
], ids=["nested-entry", "owner", "permission-type", "extra-permission", "settings",
        "script-data", "empty", "encoding", "size", "extra-shader"])
def test_rejects_invalid_material_submission(plugin, fields, source, extras, error):
    with pytest.raises(ValueError, match=error):
        plugin(fields=material_manifest(**fields), extras={"sample.wgsl": source, **extras})


def test_stable_publish_rejects_material_before_packaging(monkeypatch, tmp_path):
    def read_main(_repo, *args):
        if args == ("fetch", "origin", "refs/heads/main"):
            return b""
        if args == ("rev-parse", "FETCH_HEAD"):
            return b"main"
        pytest.fail(f"材质拒绝发布后不应继续读取 {args}")

    monkeypatch.setattr(publish, "git", read_main)
    monkeypatch.setattr(publish, "read_plugin", lambda *_: (material_manifest(), {}))
    with pytest.raises(ValueError, match="仅可发布到 preview"):
        publish.pack_reviewed(tmp_path, "daozai", ID, "stable")
    assert not (tmp_path / "package").exists()


def test_preview_publish_packs_reviewed_material_as_community_plugin(monkeypatch, tmp_path):
    plugin_id = "cayww.liquid-glass"
    manifest = status_manifest(**material_manifest(id=plugin_id, author="轻九九九（@cayww）", version="1.0.2"))
    files = {"plugin.json": json.dumps(manifest, ensure_ascii=False).encode(),
             "sample.wgsl": WGSL, "cover.png": COVER}

    def read_main(_repo, *args):
        if args == ("fetch", "origin", "refs/heads/main"):
            return b""
        if args == ("rev-parse", "FETCH_HEAD"):
            return b"reviewed-commit"
        if args == ("show", "reviewed-commit:.github/plugin-maintainers.json"):
            return json.dumps({plugin_id: "cayww"}).encode()
        if args == ("ls-tree", "reviewed-commit", "--", ".github/official-plugins.json"):
            return b"official-plugins.json"
        if args == ("show", "reviewed-commit:.github/official-plugins.json"):
            return json.dumps(["daozai.page-shortcuts"]).encode()
        pytest.fail(f"材质打包不应继续读取 {args}")

    def read_reviewed(_repo, commit, identifier):
        assert (commit, identifier) == ("reviewed-commit", plugin_id)
        return manifest, files

    def pack(island, command, manifest_path, bundle_path):
        assert (island, command) == ("daozai", "--plugin-pack")
        assert {path.name: path.read_bytes() for path in manifest_path.parent.iterdir()} == files
        bundle_path.write_bytes(b"bundle")

    monkeypatch.setattr(publish, "git", read_main)
    monkeypatch.setattr(publish, "read_plugin", read_reviewed)
    monkeypatch.setattr(publish, "daozai", pack)
    commit, version, bundle, official, description = publish.pack_reviewed(tmp_path, "daozai", plugin_id, "preview")
    assert (commit, version, official, description) == ("reviewed-commit", "1.0.2", False, None)
    assert bundle.read_bytes() == b"bundle"


@pytest.mark.parametrize("owner,capabilities", [
    ("tasks", ["card"]), ("status", ["status.page"]),
    ("quota", ["quota.source"]),
])
def test_owner_output_is_accepted(owner, capabilities):
    submission.check_script(status_manifest(owner=owner, capabilities=capabilities))


def test_quota_source_accepts_loopback_submission(plugin, monkeypatch, tmp_path):
    monkeypatch.setattr(submission, "ROOT", tmp_path)
    manifest, _ = plugin(fields={
        "owner": "quota", "capabilities": ["quota.source", "timer", "storage", "settings"],
        "permissions": {"source.read": "loopback"},
    }, check_pr=True)
    assert manifest["permissions"] == {"source.read": "loopback"}


def test_quota_source_accepts_reviewed_https_shape():
    submission.check_script(status_manifest(
        owner="quota", capabilities=["quota.source", "status.page"],
        permissions={"source.read": "https"},
        network={"hosts": ["quota.example.test"], "url": "https://quota.example.test/usage",
                 "credential": {"label": "访问密钥", "header": "Authorization", "prefix": "Bearer "}},
    ))


@pytest.mark.parametrize("fields,error", [
    ({"capabilities": ["status.page"]}, "quota.source"),
    ({"permissions": {"source.read": "file"}}, "permissions"),
    ({"permissions": {"source.read": "loopback", "other": True}}, "permissions"),
    ({"permissions": {"source.read": "loopback"}, "capabilities": ["quota.source", "status.page", "action"],
      "network": {"hosts": ["quota.example.test"]}}, "回环"),
    ({"permissions": {"source.read": "loopback"}, "attribution": {"label": "本机服务"}}, "回环"),
    ({"owner": "status", "capabilities": ["status.page"], "permissions": {"source.read": "loopback"}}, "回环"),
    ({"owner": "status", "capabilities": ["status.page", "quota.source"]}, "quota.source"),
])
def test_rejects_incorrect_quota_source_permissions(fields, error):
    manifest = {"owner": "quota", "capabilities": ["quota.source"], **fields}
    with pytest.raises(ValueError, match=error):
        submission.check_script(status_manifest(**manifest))


@pytest.mark.parametrize("fields, error", [
    ({"capabilities": []}, "status.page"),
    ({"owner": "tasks", "capabilities": ["status.page"]}, "card"),
    ({"owner": "tasks", "capabilities": ["card", "status.canvas"]}, "status.canvas.*status.page"),
    ({"owner": "tasks", "capabilities": ["card", "action"]}, "action.*status.page"),
    ({"capabilities": ["status.page", "status.page"]}, "重复"),
    ({"capabilities": ["status.page", "unknown"]}, "能力"),
    ({"capabilities": ["status.page", []]}, "能力"),
    ({"statusLayout": []}, "statusLayout"),
    ({"statusLayout": {"components": [1]}}, "statusLayout"),
    ({"statusLayout": {"components": [{"type": "canvas"}]}}, "status.canvas"),
    ({"statusLayout": {"components": [{"type": "fields"}]}}, "action"),
    ({"owner": "tasks", "capabilities": ["card"], "statusLayout": {"components": [{"type": "state"}]}}, "status.page"),
    ({"timezones": 1}, "timezones"),
    ({"events": ["focus.finished"]}, "event"),
    ({"capabilities": ["status.page", "event"]}, "events"),
    ({"capabilities": ["status.page", "event"], "events": "focus.finished"}, "events"),
    ({"minRefreshSeconds": True}, "minRefreshSeconds"),
    ({"network": []}, "network"),
    ({"attribution": "数据来源"}, "attribution"),
    ({"permissions": {"source.read": "file"}}, "permissions"),
])
def test_rejects_manifest_rules(fields, error):
    with pytest.raises(ValueError, match=error):
        submission.check_script(status_manifest(**fields))


def test_status_plugin_keeps_calendar_marker_and_navigation_icon(plugin):
    icon = {"background": "#D1584c", "path": "M6 7H18V15.5L14.5 19H6Z M9 5V8.5 M15 5V8.5"}
    manifest, files = plugin(fields={
        "capabilities": ["status.page", "status.canvas", "calendar.marker", "settings"],
        "titleAccent": "布", "statusLayout": {"components": [{"type": "canvas"}]},
        "navigationIcon": icon, "data": ["holidays.json"],
    }, extras={"holidays.json": b"[]"})
    assert manifest["navigationIcon"] == icon
    assert "holidays.json" in files


@pytest.mark.parametrize("field,fields", [
    ("calendar.marker", {"owner": "tasks", "capabilities": ["card", "calendar.marker"]}),
    ("calendar.marker", {"capabilities": ["calendar.marker"]}),
    ("navigationIcon", {"owner": "tasks", "capabilities": ["card", "status.page"], "navigationIcon": {}}),
    ("navigationIcon", {"capabilities": ["card"], "navigationIcon": {}}),
])
def test_only_independent_status_pages_accept_calendar_marker_and_navigation_icon(field, fields):
    with pytest.raises(ValueError, match=field):
        submission.check_script(status_manifest(**fields))


@pytest.mark.parametrize("fields", [
    {"runtime": "assets", "owner": "pages", "entry": "shortcuts.json", "dataVersion": 1,
     "settings": [], "capabilities": ["navigation.shortcuts"]},
    material_manifest(),
])
def test_non_script_package_rejects_navigation_icon(plugin, fields):
    with pytest.raises(ValueError, match="navigationIcon"):
        plugin(fields={**fields, "navigationIcon": {"path": "M0 0 H1", "background": "#112233"}})


@pytest.mark.parametrize("path", [
    "  M0,0 H24 V24 Z   M8 8 Q12 4 16 8",
    "m2 2, 2 2 h3v.5c1 1 2 2 3 3q-1-1-2-2z h1",
    "M0\t0\r\nL.5,+1e0 2 3 H24,",
    "M0 0 H24.00000001",
    "M0 0" + " L1 1" * 63,
], ids=["absolute", "relative", "separators", "f32", "segment-limit"])
def test_navigation_icon_accepts_host_path_syntax(path):
    submission.check_navigation_icon({"path": path, "background": "#1234aF"})


@pytest.mark.parametrize("icon,error", [
    (None, "path 和 background"),
    ({"path": "M0 0 H1"}, "path 和 background"),
    ({"path": "M0 0 H1", "background": "#112233", "extra": True}, "path 和 background"),
    ({"path": "M0 0 H1", "background": "#fff"}, "#RRGGBB"),
    ({"path": "", "background": "#112233"}, "须以 M"),
    ({"path": "M0 0 Z", "background": "#112233"}, "至少需要一条"),
    ({"path": "M0 0 A1 1 0 0 0 8 8", "background": "#112233"}, "只支持"),
    ({"path": "M0,,0 H1", "background": "#112233"}, "只支持"),
    ({"path": "M0 0 Z 1 1", "background": "#112233"}, "只支持"),
    ({"path": "M0 0 H1　", "background": "#112233"}, "ASCII"),
    ({"path": "M0 0 H25", "background": "#112233"}, "0 到 24"),
    ({"path": "M0 0 h-1", "background": "#112233"}, "0 到 24"),
    ({"path": "M0 0 Q25 3 8 8", "background": "#112233"}, "0 到 24"),
    ({"path": "M0 0 C1 1 2 -1 8 8", "background": "#112233"}, "0 到 24"),
    ({"path": "M0 0 H1e999", "background": "#112233"}, "0 到 24"),
    ({"path": "M0 0 " + "1 1 " * 64, "background": "#112233"}, "最多 64 条"),
    ({"path": "M0 0 H24" + " " * 1024, "background": "#112233"}, "最多 1024"),
], ids=["null", "missing", "extra", "color", "empty", "move-only", "arc", "double-comma",
        "after-close", "non-ascii", "outside", "relative-outside", "quad-control", "cubic-control",
        "non-finite", "implicit-segment-limit", "length"])
def test_navigation_icon_rejects_invalid_host_paths(icon, error):
    with pytest.raises(ValueError, match=error):
        submission.check_navigation_icon(icon)


def test_accepts_title_accent_and_canvas_fields():
    submission.check_script(status_manifest(
        name="便签本", titleAccent="本", capabilities=["status.page", "status.canvas", "action"],
        statusLayout={"components": [{"type": "canvas"}], "canvasFields": [
            {"key": "note", "rect": [4, 207, 130, 22], "placeholder": "记一笔…", "action": "add"},
            {"key": "search", "rect": [202, 7, 182, 24]},
            {"key": "edge", "rect": [386, 359, 1, 1]},
        ]},
    ))


@pytest.mark.parametrize("name, suffix, capabilities", [
    ("便签本", "便签", ["status.page"]), ("便签本", "", ["status.page"]),
    ("便签本", "便签本", ["status.page"]), (" 本", "本", ["status.page"]),
    ("便签本", None, ["status.page"]), ("便签本\n", "本\n", ["status.page"]),
    ("便签本", "本", ["card"]),
])
def test_rejects_invalid_title_accent(name, suffix, capabilities):
    fields = {"owner": "status" if "status.page" in capabilities else "tasks",
              "name": name, "titleAccent": suffix, "capabilities": capabilities}
    with pytest.raises(ValueError, match="titleAccent"):
        submission.check_script(status_manifest(**fields))


@pytest.mark.parametrize("fields", [
    {}, [1], [{"key": "note", "rect": [0, 0, 1]}],
    [{"key": "note", "rect": [-1, 0, 1, 1]}], [{"key": "note", "rect": [0, 0, 0, 1]}],
    [{"key": "note", "rect": [0, 359, 1, 2]}], [{"key": "note", "rect": [386, 0, 2, 1]}],
    [{"key": "note", "rect": [0, 0, True, 1]}], [{"key": "note", "rect": [0, 0, 1.5, 1]}],
    [{"key": "NOTE", "rect": [0, 0, 1, 1]}],
    [{"key": "note", "rect": [0, 0, 1, 1], "action": "1-no"}],
    [{"key": "note", "rect": [0, 0, 1, 1], "placeholder": "  "}],
    [{"key": "note", "rect": [0, 0, 1, 1], "placeholder": "字" * 81}],
    [{"key": "note", "rect": [0, 0, 1, 1], "placeholder": "写\n字"}],
    [{"key": "note", "rect": [0, 0, 1, 1]}] * 2,
    [{"key": f"note{i}", "rect": [0, 0, 1, 1]} for i in range(4)],
])
def test_rejects_invalid_canvas_fields(fields):
    with pytest.raises(ValueError, match="canvasFields"):
        submission.check_script(status_manifest(
            capabilities=["status.page", "status.canvas", "action"],
            statusLayout={"components": [{"type": "canvas"}], "canvasFields": fields},
        ))


@pytest.mark.parametrize("capabilities, component", [
    (["status.page", "status.canvas", "action"], "state"),
    (["status.page", "status.canvas"], "canvas"),
    (["status.page", "action"], "canvas"),
])
def test_canvas_fields_require_canvas_and_actions(capabilities, component):
    with pytest.raises(ValueError, match="canvasFields|status.canvas"):
        submission.check_script(status_manifest(capabilities=capabilities, statusLayout={
            "components": [{"type": component}], "canvasFields": [{"key": "note", "rect": [0, 0, 1, 1]}],
        }))


@pytest.mark.parametrize("names", ["file.json", ["../hidden.json"], ["CON.json"], ["data.json", "DATA.json"]])
def test_rejects_invalid_data_names(names):
    with pytest.raises(ValueError, match="data"):
        submission.check_file_names(names, "data", (".json",))


def https_fields(**network):
    return {
        "permissions": {"source.read": "https"},
        "network": {"hosts": ["example.test"], **network},
    }


def test_accepts_https_sources_and_attribution():
    submission.check_script(status_manifest(**{
        **https_fields(sources=[{"key": "spot", "url": "https://EXAMPLE.test/a?unit={unit}"},
                                {"key": "history", "url": "https://example.test:443/history"}],
                       minRefreshSeconds=60),
        "minRefreshSeconds": 300,
        "attribution": {"label": "来源", "url": "https://example.test/info"},
    }))


@pytest.mark.parametrize("network", [
    {"hosts": "example.test"}, {"hosts": ["localhost"]}, {"hosts": ["x.localhost"]},
    {"hosts": ["*.example.test"]}, {"hosts": ["127.0.0.1"]}, {"hosts": ["example.test:443"]},
    {"hosts": ["example.test", "EXAMPLE.TEST"]}, {"sources": {}},
    {"sources": [{"key": "x", "url": "http://example.test/a"}]},
    {"sources": [{"key": "x", "url": "https://a.example.test/a"}]},
    {"sources": [{"key": "x", "url": "https://example.test@other.test/a"}]},
    {"sources": [{"key": "x", "url": "https://@example.test/a"}]},
    {"sources": [{"key": "x", "url": "https://example.test:80/a"}]},
    {"sources": [{"key": "x", "url": "https://example.test/a#fragment"}]},
    {"sources": [{"key": "x", "url": "https://example.test/\\bad"}]},
    {"sources": [{"key": "x", "url": "https://example.test/a"}] * 2},
    {"sources": [{"url": "https://example.test/a"}]}, {"minRefreshSeconds": 59},
])
def test_rejects_invalid_network(network):
    with pytest.raises(ValueError, match="network"):
        submission.check_script(status_manifest(**https_fields(**network)))


def test_rejects_attribution_from_another_host():
    with pytest.raises(ValueError, match="attribution"):
        submission.check_script(status_manifest(**https_fields(), attribution={"label": "来源", "url": "https://other.test"}))


def test_accepts_package_data_at_limits(plugin):
    names = [f"data{i}.json" for i in range(4)]
    _, files = plugin(fields={"data": names}, extras={name: b"0" + b" " * (64 * KIB - 1) for name in names})
    assert sum(len(files[name]) for name in names) == 256 * KIB


@pytest.mark.parametrize("kind, count, byte_limit, expected", [
    ("data", 1, 64 * KIB + 1, "大小限制"),
    ("data", 5, 64 * KIB, "256 KiB"),
    ("assets", 2, 256 * KIB + 1, "512 KiB"),
])
def test_rejects_attachment_size(plugin, kind, count, byte_limit, expected):
    suffix, seed = ("json", b"0") if kind == "data" else ("svg", SVG)
    names = [f"file{i}.{suffix}" for i in range(count)]
    fields = {"capabilities": ["status.page", "status.canvas"]}
    if kind == "data":
        fields["data"] = names
    with pytest.raises(ValueError, match=expected):
        plugin(fields=fields, extras={name: seed.ljust(byte_limit) for name in names})


@pytest.mark.parametrize("fields, extras, expected", [
    ({"data": ["lost.json"]}, {}, "lost.json"),
    ({"data": ["data.json"]}, {"data.json": b"NaN"}, "JSON"),
    ({}, {"stray.json": b"{}"}, "未支持"),
    ({"capabilities": ["status.page", "status.canvas"]}, {"picture..png": COVER}, "图片.*路径"),
    ({"capabilities": ["status.page", "status.canvas"]}, {"picture.jpg": b"image"}, "未支持"),
    ({}, {"other/file.png": COVER}, "未支持"),
    ({}, {"nested/TESTING.md": b"tests"}, "未支持"),
])
def test_rejects_invalid_attachments(plugin, fields, extras, expected):
    with pytest.raises(ValueError, match=expected):
        plugin(fields=fields, extras=extras)

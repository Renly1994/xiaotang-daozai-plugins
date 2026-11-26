"""从 Git 对象读取投稿并做静态检查。"""
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ID = re.compile(r"[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+")
VERSION = re.compile(r"(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){2}")
USB_ID = re.compile(r"[0-9a-fA-F]{4}")
WIRELESS_ID = "daozai.wireless-receivers"
WIRELESS_ENTRY = "wireless-receivers.json"
MATERIAL_ENTRY = re.compile(r"[a-zA-Z0-9_-]+\.wgsl")
MATERIAL_LIMIT = 64 * 1024
PACKAGE_FILES = {
    "plugin.json": 32 * 1024,
    "main.js": 256 * 1024,
    "shortcuts.json": 4 * 1024,
    WIRELESS_ENTRY: 256 * 1024,
    "cover.png": 256 * 1024,
}
SHORTCUT_PAGES = {
    "music", "focus", "health", "shelf", "tasks", "mail", "quota", "calendar",
    "weather", "performance", "wireless",
}
SHORTCUT_COLOR = re.compile(r"#[0-9A-Fa-f]{6}")
NAVIGATION_AXES = {"M": (0, 1), "L": (0, 1), "H": (0,), "V": (1,),
                   "Q": (0, 1, 0, 1), "C": (0, 1, 0, 1, 0, 1), "Z": ()}
NAVIGATION_NUMBER = re.compile(
    r"[ \t\r\n]*([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)[ \t\r\n]*,?"
)
OPTIONAL_FILES = {"README.md", "LICENSE", "LICENSE.txt"}
SCRIPT_OWNERS = {"tasks": {"card"}, "status": {"status.page"}, "quota": {"quota.source"}}
SCRIPT_CAPABILITIES = {
    "status.page", "status.canvas", "island.pinned", "action", "event", "notice",
    "timer", "storage", "settings", "card", "calendar.marker", "quota.source",
}
DOMAIN = re.compile(r"(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")
CONTROL_ID = re.compile(r"[a-z][a-z0-9_-]{0,39}")
WINDOWS_DEVICE = re.compile(r"CON|PRN|AUX|NUL|(?:COM|LPT)[1-9]", re.IGNORECASE)
DATA_LIMIT = 64 * 1024
IMAGE_TOTAL_LIMIT = 512 * 1024


def git(repo, *args):
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, stdout=subprocess.PIPE,
    ).stdout


def version(value):
    if not isinstance(value, str) or len(value) > 32 or not VERSION.fullmatch(value):
        raise ValueError("版本号必须为 major.minor.patch")
    numbers = tuple(map(int, value.split(".")))
    if max(numbers) > 2**32 - 1:
        raise ValueError("版本号超出支持范围")
    return numbers


def check_cover(cover):
    if (len(cover) < 45 or not cover.startswith(b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR")
            or not cover.endswith(b"\0\0\0\0IEND\xaeB`\x82")):
        raise ValueError("封面必须为完整的 PNG 图片")
    width, height = struct.unpack(">II", cover[16:24])
    if not (0 < width <= 1920 and 0 < height <= 1080):
        raise ValueError("封面尺寸必须小于或等于 1920 × 1080")


def check_shortcuts(raw):
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict) or data.keys() != {"colors"}:
        raise ValueError("shortcuts.json 必须只包含 colors")
    colors = data["colors"]
    if not isinstance(colors, dict) or not colors or colors.keys() - SHORTCUT_PAGES:
        raise ValueError("请至少为一个已知功能页设置配色")
    if any(not isinstance(color, str) or not SHORTCUT_COLOR.fullmatch(color) for color in colors.values()):
        raise ValueError("快捷切换配色必须使用 #RRGGBB 格式")


def check_wireless(payload, manifest):
    data = json.loads(payload.decode("utf-8"))
    if (not isinstance(data, dict) or data.keys() != {"id", "api_version", "version", "receivers"}
            or data["id"] != manifest["id"] or type(data["api_version"]) is not int
            or data["api_version"] != manifest["api"] or data["version"] != manifest["version"]
            or not isinstance(data["receivers"], list)):
        raise ValueError("接收器识别表的 ID、接口版本、包版本或格式不符")
    seen = set()
    for row in data["receivers"]:
        if not isinstance(row, dict) or row.keys() != {"vid", "pid", "name"}:
            raise ValueError("接收器条目必须包含 VID、PID 和名称")
        vid, pid, name = row["vid"], row["pid"], row["name"]
        if not all(isinstance(value, str) and USB_ID.fullmatch(value) for value in (vid, pid)) or vid == "0000":
            raise ValueError("接收器 VID/PID 无效")
        if (not isinstance(name, str) or not 0 < len(name) <= 64 or name.strip() != name
                or any(unicodedata.category(char) in {"Cc", "Cs"} for char in name)):
            raise ValueError("接收器名称无效")
        pair = (vid.upper(), pid.upper())
        if pair in seen:
            raise ValueError("接收器识别表有重复的 VID/PID")
        seen.add(pair)


def valid_package_path(name):
    return (isinstance(name, str) and bool(name) and ".." not in name
            and not any(unicodedata.category(char) in {"Cc", "Cs"} or char in '\\:*?"<>|' for char in name)
            and all(part and not part.startswith((".", " ")) and not part.endswith((".", " "))
                    and not WINDOWS_DEVICE.fullmatch(part.split(".")[0]) for part in name.split("/")))


def check_file_names(names, field, extensions):
    if not isinstance(names, list) or any(
        not valid_package_path(name) or "/" in name or not name.endswith(extensions)
        or name.lower() == "plugin.json"
        for name in names
    ) or len({name.casefold() for name in names}) != len(names):
        raise ValueError(f"{field} 必须列出互不重复的包内文件名")


def check_refresh(value, field):
    if type(value) is not int or not 60 <= value <= 86400:
        raise ValueError(f"{field} 必须为 60 至 86400 秒的整数")


def valid_host(host):
    return (isinstance(host, str) and len(host) <= 253 and DOMAIN.fullmatch(host)
            and not host.lower().endswith(".localhost")
            and not re.fullmatch(r"[0-9]+|0x[0-9a-f]*", host.lower().rsplit(".", 1)[-1]))


def check_url(value, hosts, field):
    if (not isinstance(value, str) or len(value) > 2048 or not value.lower().startswith("https://")
            or "#" in value or "\\" in value or any(unicodedata.category(char) == "Cc" for char in value)):
        raise ValueError(f"{field} 必须为使用已声明域名的 HTTPS 地址")
    authority = re.split(r"[/?]", value[8:], maxsplit=1)[0].lower()
    if authority.removesuffix(":443") not in hosts:
        raise ValueError(f"{field} 必须为使用已声明域名的 HTTPS 地址")


def check_network(manifest, capabilities):
    permissions = manifest.get("permissions")
    if permissions == {"source.read": "loopback"}:
        if manifest["owner"] != "quota" or "network" in manifest or "attribution" in manifest:
            raise ValueError("回环只读权限仅适用于额度来源，且不能声明 network 或 attribution")
        return
    https = permissions == {"source.read": "https"}
    if permissions != {} and not https:
        raise ValueError("permissions 只支持空权限、HTTPS 只读来源或额度回环只读来源")
    if "network" not in manifest:
        if https or "attribution" in manifest:
            raise ValueError("HTTPS 数据源或 attribution 需要 network")
        return

    network = manifest["network"]
    if not isinstance(network, dict) or network.keys() - {"hosts", "url", "sources", "minRefreshSeconds", "credential"}:
        raise ValueError("network 必须是网络配置对象")
    if not https and ("action" not in capabilities or network.keys() != {"hosts"}):
        raise ValueError("network 数据源需要 HTTPS 只读权限，打开链接需要 action")
    hosts = network.get("hosts")
    if not isinstance(hosts, list) or not 1 <= len(hosts) <= 4 or not all(map(valid_host, hosts)):
        raise ValueError("network.hosts 必须列出 1 至 4 个完整域名")
    hosts = [host.lower() for host in hosts]
    if len(set(hosts)) != len(hosts):
        raise ValueError("network.hosts 存在重复域名")
    if "url" in network:
        check_url(network["url"], hosts, "network.url")
    if "sources" in network:
        sources = network["sources"]
        if "url" in network or not isinstance(sources, list) or not 1 <= len(sources) <= 3:
            raise ValueError("network.sources 必须列出 1 至 3 个独立数据源")
        keys = set()
        for source in sources:
            if not isinstance(source, dict) or source.keys() != {"key", "url"}:
                raise ValueError("network.sources 必须提供 key 和 url")
            key = source["key"]
            if not isinstance(key, str) or not CONTROL_ID.fullmatch(key) or key in keys:
                raise ValueError("network.sources 的 key 无效或重复")
            keys.add(key)
            check_url(source["url"], hosts, "network.sources.url")
    if "minRefreshSeconds" in network:
        check_refresh(network["minRefreshSeconds"], "network.minRefreshSeconds")
    if "credential" in network:
        credential = network["credential"]
        if (not isinstance(credential, dict) or not {"label", "header"} <= credential.keys()
                or credential.keys() - {"label", "header", "prefix"}
                or not all(isinstance(value, str) for value in credential.values())):
            raise ValueError("network.credential 必须声明凭据名称和请求头")
    if "attribution" in manifest:
        attribution = manifest["attribution"]
        if (not https or not isinstance(attribution, dict) or attribution.keys() - {"label", "url"}
                or not isinstance(label := attribution.get("label"), str) or not label.strip()
                or len(label) > 80 or any(unicodedata.category(char) == "Cc" for char in label)):
            raise ValueError("attribution 必须为 HTTPS 数据源声明来源名称")
        if "url" in attribution:
            check_url(attribution["url"], hosts, "attribution.url")


def valid_status_text(value):
    return (isinstance(value, str) and bool(value.strip()) and len(value) <= 80
            and not any(unicodedata.category(char) in {"Cc", "Cs"} for char in value))


def check_navigation_icon(icon):
    if not isinstance(icon, dict) or icon.keys() != {"path", "background"}:
        raise ValueError("navigationIcon 必须包含 path 和 background")
    background, path = icon["background"], icon["path"]
    if not isinstance(background, str) or not SHORTCUT_COLOR.fullmatch(background):
        raise ValueError("navigationIcon.background 须为 #RRGGBB")
    if not isinstance(path, str) or not path.isascii() or len(path) > 1024:
        raise ValueError("navigationIcon.path 最多 1024 个 ASCII 字节")
    whitespace = " \t\r\n"
    path = path.lstrip(whitespace)
    invalid_path = "navigationIcon.path 须以 M 或 m 开始，只支持 M、L、H、V、Q、C、Z"
    if not path.startswith(("M", "m")):
        raise ValueError(invalid_path)
    command = ""
    current = origin = (0.0, 0.0)
    draws = False
    count = 0
    while path:
        if path[0].upper() in NAVIGATION_AXES:
            command, path = path[0], path[1:]
        elif command.upper() == "Z":
            raise ValueError(invalid_path)
        count += 1
        if count > 64:
            raise ValueError("navigationIcon.path 最多 64 条命令")
        kind = command.upper()
        if kind == "Z":
            current = origin
        else:
            coordinates = []
            for axis in NAVIGATION_AXES[kind]:
                match = NAVIGATION_NUMBER.match(path)
                if match is None:
                    raise ValueError(invalid_path)
                path = path[match.end():]
                value = float(match[1])
                if not -2000 <= value <= 2000:
                    raise ValueError("navigationIcon.path 坐标须在 0 到 24 之间")
                resolved = value + current[axis] if command.islower() else value
                # 与宿主一样，将相对坐标转换为 f32 后检查最终位置。
                coordinate, = struct.unpack("<f", struct.pack("<f", resolved))
                if not 0 <= coordinate <= 24:
                    raise ValueError("navigationIcon.path 坐标须在 0 到 24 之间")
                coordinates.append(coordinate)
            if kind == "H":
                current = coordinates[0], current[1]
            elif kind == "V":
                current = current[0], coordinates[0]
            else:
                current = tuple(coordinates[-2:])
            if kind == "M":
                origin = current
                command = "l" if command.islower() else "L"
            else:
                draws = True
        path = path.lstrip(whitespace)
    if not draws:
        raise ValueError("navigationIcon.path 至少需要一条直线或曲线")


def check_canvas_fields(layout, capabilities):
    fields = layout["canvasFields"]
    if not isinstance(fields, list) or len(fields) > 3:
        raise ValueError("canvasFields 必须为最多 3 项的数组")
    if fields and (not {"status.canvas", "action"} <= capabilities
                   or not any(component["type"] == "canvas" for component in layout["components"])):
        raise ValueError("canvasFields 需要 canvas 组件以及 status.canvas 和 action 能力")

    keys = set()
    for field in fields:
        if (not isinstance(field, dict) or not {"key", "rect"} <= field.keys()
                or field.keys() - {"key", "rect", "placeholder", "action"}):
            raise ValueError("canvasFields 每项必须提供 key 和 rect")
        key, rect = field["key"], field["rect"]
        if (not isinstance(key, str) or not CONTROL_ID.fullmatch(key) or key in keys
                or not isinstance(rect, list) or len(rect) != 4 or not all(type(value) is int for value in rect)):
            raise ValueError("canvasFields 的键与位置无效，键不能重复")
        x, y, width, height = rect
        if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > 387 or y + height > 360:
            raise ValueError("canvasFields 输入框必须位于 387 × 360 的画布内容范围内")
        if "placeholder" in field and not valid_status_text(field["placeholder"]):
            raise ValueError("canvasFields 的 placeholder 必须为 1 至 80 字的提示")
        if "action" in field and (not isinstance(field["action"], str) or not CONTROL_ID.fullmatch(field["action"])):
            raise ValueError("canvasFields 的 action 必须为有效动作 ID")
        keys.add(key)


def check_status_layout(layout, capabilities):
    if "status.page" not in capabilities:
        raise ValueError("statusLayout 需要同时声明 status.page")
    if (not isinstance(layout, dict) or layout.keys() - {"components", "style", "canvasFields"}
            or not isinstance(layout.get("components"), list) or not 1 <= len(layout["components"]) <= 10
            or ("style" in layout and not isinstance(layout["style"], dict))):
        raise ValueError("statusLayout 必须包含 1 至 10 个组件")
    component_types = {
        "state", "summary", "alert", "updated_at", "actions", "fields", "list", "chart", "text",
        "badge", "counter", "clock", "countdown", "progress", "metrics", "canvas",
    }
    for component in layout["components"]:
        if (not isinstance(component, dict) or not isinstance(kind := component.get("type"), str)
                or kind not in component_types):
            raise ValueError("statusLayout 包含无效的组件")
        if kind == "canvas" and "status.canvas" not in capabilities:
            raise ValueError("画布组件需要声明 status.canvas")
        if kind in {"actions", "fields"} and "action" not in capabilities:
            raise ValueError("按钮和表单组件需要声明 action")
    if "canvasFields" in layout:
        check_canvas_fields(layout, capabilities)


def check_script(manifest):
    owner = manifest.get("owner")
    if not isinstance(owner, str) or owner not in SCRIPT_OWNERS:
        raise ValueError("集市支持待办、状态页和 AI 额度归属")
    capabilities = manifest.get("capabilities")
    if not isinstance(capabilities, list) or any(
        not isinstance(name, str) or name not in SCRIPT_CAPABILITIES for name in capabilities
    ):
        raise ValueError("清单含有不支持的脚本能力")
    names = set(capabilities)
    if len(names) != len(capabilities):
        raise ValueError("清单能力重复声明")
    if "quota.source" in names and owner != "quota":
        raise ValueError("quota.source 只适用于 AI 额度归属")
    independent_page = owner == "status" and "status.page" in names
    if "calendar.marker" in names and not independent_page:
        raise ValueError("calendar.marker 只适用于声明了 status.page 的独立状态页插件")
    if "navigationIcon" in manifest:
        if not independent_page:
            raise ValueError("navigationIcon 只适用于声明了 status.page 的独立状态页插件")
        check_navigation_icon(manifest["navigationIcon"])
    for name in ("status.canvas", "action"):
        if name in names and "status.page" not in names:
            raise ValueError(f"{name} 需要同时声明 status.page")
    if not names & SCRIPT_OWNERS[owner]:
        raise ValueError(f"{owner} 归属需要声明 {' 或 '.join(sorted(SCRIPT_OWNERS[owner]))}")
    if "titleAccent" in manifest:
        suffix, title = manifest["titleAccent"], manifest.get("name")
        if ("status.page" not in names or not valid_status_text(suffix)
                or not isinstance(title, str) or not title.endswith(suffix) or not title.removesuffix(suffix).strip()):
            raise ValueError("titleAccent 必须是状态页插件名称的一段非空末尾文字")
    if (("events" in manifest) != ("event" in names)
            or ("events" in manifest and manifest["events"] != ["focus.finished"])):
        raise ValueError("声明 event 时须在 events 订阅一次 focus.finished")
    if "timezones" in manifest and type(manifest["timezones"]) is not bool:
        raise ValueError("timezones 必须为布尔值")
    if "minRefreshSeconds" in manifest:
        check_refresh(manifest["minRefreshSeconds"], "minRefreshSeconds")
    if "statusLayout" in manifest:
        check_status_layout(manifest["statusLayout"], names)
    check_network(manifest, names)


def check_material(manifest, source):
    permissions = manifest.get("permissions")
    if (not isinstance(permissions, dict) or permissions.keys() != {"screen.backdrop"}
            or permissions["screen.backdrop"] is not True):
        raise ValueError("材质只允许 screen.backdrop 权限")
    capabilities = manifest.get("capabilities")
    if capabilities not in (["appearance.material"], ["appearance.material", "settings"],
                            ["settings", "appearance.material"]):
        raise ValueError("材质须声明 appearance.material，可选 settings 能力")
    settings = manifest.get("settings")
    if (not isinstance(settings, list) or len(settings) > 32
            or (settings and "settings" not in capabilities)
            or any(not isinstance(field, dict) or field.get("type") != "number" for field in settings)):
        raise ValueError("材质只支持最多 32 个数字设置")
    material = manifest.get("material")
    if (not isinstance(material, dict) or material.keys() - {"controls", "spring", "shadow", "foreground"}
            or type(material.get("controls")) is not bool
            or material.get("foreground", "skin") not in ("skin", "glass")):
        raise ValueError("材质的 controls 和 foreground 参数无效")
    spring = material.get("spring")
    if not isinstance(spring, dict) or spring.keys() != {"stiffness", "damping"}:
        raise ValueError("材质须声明 spring.stiffness 和 spring.damping")
    for value, minimum, maximum in (
        (spring["stiffness"], 0.2, 3), (spring["damping"], 0.1, 1),
        (material.get("shadow", 0), 0, 1.5),
    ):
        if type(value) not in (int, float) or not minimum <= value <= maximum:
            raise ValueError("材质的 spring 或 shadow 参数超出范围")
    try:
        text = source.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("WGSL 入口必须使用 UTF-8") from error
    if not text.strip():
        raise ValueError("WGSL 入口不能为空")


def load_json(raw, name):
    def invalid_constant(value):
        raise ValueError(f"JSON 不支持 {value}")

    try:
        return json.loads(raw.decode("utf-8"), parse_constant=invalid_constant)
    except (ValueError, RecursionError) as error:
        raise ValueError(f"{name} 必须是有效的 UTF-8 JSON") from error


def is_dev_file(name):
    return name == "TESTING.md" or name.startswith("fixtures/")


def read_plugin(repo, commit, plugin_id):
    if len(plugin_id) > 64 or not PLUGIN_ID.fullmatch(plugin_id):
        raise ValueError(f"插件 ID 无效：{plugin_id}")
    prefix = f"plugins/{plugin_id}/"
    records = git(repo, "ls-tree", "-rlz", commit, "--", prefix).split(b"\0")
    entries, seen = {}, set()
    for record in filter(None, records):
        header, path = record.split(b"\t", 1)
        mode, _, oid, size = header.decode().split()
        name = path.decode().removeprefix(prefix)
        if mode != "100644" or name.casefold() in seen:
            raise ValueError(f"插件目录出现未支持的文件：{prefix}{name}")
        seen.add(name.casefold())
        entries[name] = (oid, int(size))

    def read(name, limit):
        if name not in entries:
            raise ValueError(f"{plugin_id} 缺少文件：{name}")
        oid, size = entries[name]
        if size > limit:
            raise ValueError(f"{prefix}{name} 超出大小限制")
        return git(repo, "cat-file", "blob", oid)

    files = {name: read(name, PACKAGE_FILES[name]) for name in ("plugin.json", "cover.png")}
    manifest = load_json(files["plugin.json"], "plugin.json")
    if not isinstance(manifest, dict) or manifest.get("id") != plugin_id:
        raise ValueError(f"清单 ID 必须与目录 {plugin_id} 一致")
    version(manifest.get("version"))
    for field in ("name", "author"):
        value = manifest.get(field)
        if not isinstance(value, str) or not value.strip() or len(value) > 80:
            raise ValueError(f"清单 {field} 必须为 1 至 80 字符的非空名称")
    required = {"api": 1, "cover": "cover.png"}
    is_material = manifest.get("runtime") == "material"
    if plugin_id == WIRELESS_ID:
        entry = WIRELESS_ENTRY
        required.update(runtime="assets", owner="wireless", entry=entry, dataVersion=1,
                        settings=[], capabilities=["wireless.receivers"])
    elif manifest.get("runtime") == "assets":
        entry = "shortcuts.json"
        required.update(runtime="assets", owner="pages", entry=entry, dataVersion=1,
                        settings=[], capabilities=["navigation.shortcuts"])
    elif is_material:
        entry = manifest.get("entry")
        if not (valid_package_path(entry) and MATERIAL_ENTRY.fullmatch(entry)):
            raise ValueError("材质入口必须是包根目录的 WGSL 文件")
        required.update(owner="appearance", dataVersion=1)
    else:
        entry = "main.js"
        required.update(runtime="js", entry=entry)
    if entry != "main.js":
        if "navigationIcon" in manifest:
            raise ValueError("navigationIcon 只适用于声明了 status.page 的独立状态页插件")
        if not is_material:
            required["permissions"] = {}
        if {"statusLayout", "titleAccent", "network", "data", "timezones", "minRefreshSeconds", "attribution", "events"} & manifest.keys():
            raise ValueError("资源包不能声明脚本清单字段")
    for key, value in required.items():
        if type(manifest.get(key)) is not type(value) or manifest[key] != value:
            raise ValueError(f"清单 {key} 与 {entry} 对应的插件格式不符")
    files[entry] = read(entry, MATERIAL_LIMIT if is_material else PACKAGE_FILES[entry])
    allowed = set(files) | OPTIONAL_FILES
    if entry == "shortcuts.json":
        check_shortcuts(files[entry])
    elif entry == WIRELESS_ENTRY:
        check_wireless(files[entry], manifest)
    elif is_material:
        check_material(manifest, files[entry])
    else:
        check_script(manifest)
        if not files[entry].decode("utf-8").strip():
            raise ValueError("main.js 不能为空")
        data = manifest.get("data", [])
        check_file_names(data, "data", (".json",))
        if any(name.casefold() in PACKAGE_FILES for name in data):
            raise ValueError("data 不可引用插件入口文件")
        if sum(entries[name][1] for name in data if name in entries) > 256 * 1024:
            raise ValueError("JSON 数据文件合计超过 256 KiB")
        for name in data:
            contents = read(name, DATA_LIMIT)
            load_json(contents, name)
            files[name] = contents
        allowed.update(data)
        if "status.canvas" in manifest["capabilities"]:
            images = [name for name in entries if name != "cover.png" and not is_dev_file(name)
                      and name.lower().endswith((".png", ".svg"))]
            if any(not valid_package_path(name) for name in images):
                raise ValueError("画布图片须使用安全的包内路径")
            if sum(entries[name][1] for name in images) > IMAGE_TOTAL_LIMIT:
                raise ValueError("画布图片合计超过 512 KiB")
            for name in images:
                files[name] = read(name, IMAGE_TOTAL_LIMIT)
            allowed.update(images)
    for name, (_, size) in entries.items():
        if is_dev_file(name):
            continue
        if name not in allowed:
            raise ValueError(f"插件目录出现未支持的文件：{prefix}{name}")
        if name in OPTIONAL_FILES and size > DATA_LIMIT:
            raise ValueError(f"{prefix}{name} 超出大小限制")
    check_cover(files["cover.png"])
    return manifest, files


def changed_paths(base, head):
    fork = git(ROOT, "merge-base", base, head).decode().strip()
    changed = git(ROOT, "diff", "--name-only", "-z", "--no-renames", fork, head)
    return list(filter(None, changed.decode().split("\0")))


def check_pull_request(base, head, paths=None):
    ids = set()
    if paths is None:
        paths = changed_paths(base, head)
    for path in paths:
        parts = path.split("/")
        if len(parts) < 3 or parts[0] != "plugins":
            raise ValueError(f"投稿 PR 只能修改插件目录：{path}")
        ids.add(parts[1])
    if not ids:
        raise ValueError("投稿 PR 未包含插件变更")
    for plugin_id in sorted(ids):
        manifest, _ = read_plugin(ROOT, head, plugin_id)
        if git(ROOT, "ls-tree", base, "--", f"plugins/{plugin_id}"):
            previous, _ = read_plugin(ROOT, base, plugin_id)
            if version(manifest["version"]) <= version(previous["version"]):
                raise ValueError(f"{plugin_id} 必须提交高于主分支的版本")
        print(f"{plugin_id} {manifest['version']} 静态检查通过")
    return ids


if __name__ == "__main__":
    try:
        check_pull_request(*sys.argv[1:])
    except (ValueError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))

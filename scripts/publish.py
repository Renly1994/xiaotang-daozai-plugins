"""发布已合并插件，确认国内镜像能读到 ZIP 后再更新目录。"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

from route_feedback import LOGIN
from submission import PLUGIN_ID, ROOT, git, read_plugin, version

GITEE_PATH = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
MIRROR_BRANCH = "master"
ZIP_LIMIT = 576 * 1024
CATALOG_LIMIT = 64 * 1024
METRICS_DIR = ROOT / "services" / "market-metrics"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def publish_origin(value):
    match = re.fullmatch(r"(https://gitee\.com/|git@gitee\.com:)([^?#]+)", value)
    if not match:
        raise ValueError("镜像须为 Gitee HTTPS 或 SSH Git 地址")
    path = match[2].removesuffix(".git")
    if not GITEE_PATH.fullmatch(path) or set(path.split("/")) & {".", ".."}:
        raise ValueError("Gitee 仓库地址无效")
    return f"https://gitee.com/api/v5/repos/{path}/contents"


def decode_public_file(record, path, limit):
    if (not isinstance(record, dict) or record.get("type") != "file"
            or record.get("path") != path or record.get("encoding") != "base64"):
        raise ValueError("Gitee 公开文件元数据无效")
    size = record.get("size")
    content = record.get("content")
    if type(size) is not int or not 0 < size <= limit or not isinstance(content, str):
        raise ValueError("Gitee 公开文件大小无效")
    encoded = content.replace("\r", "").replace("\n", "")
    if len(encoded) != (size + 2) // 3 * 4:
        raise ValueError("Gitee 公开文件长度不符")
    try:
        data = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise ValueError("Gitee 公开文件编码无效") from None
    if len(data) != size:
        raise ValueError("Gitee 公开文件大小不符")
    return data


def download_public(base_url, path, limit, missing_ok=False):
    url = f"{base_url}/{urllib.parse.quote(path)}?ref={MIRROR_BRANCH}"
    # 为 Base64、换行转义及元数据留出空间，仍对整个响应限长。
    response_limit = (limit + 2) // 3 * 8 + 8192
    client = urllib.request.build_opener(NoRedirect())
    try:
        with client.open(url, timeout=8) as response:
            data = response.read(response_limit + 1)
    except urllib.error.HTTPError as error:
        if error.code == 404 and missing_ok:
            return None
        raise ValueError(f"Gitee 公开文件返回 HTTP {error.code}") from None
    except (TimeoutError, urllib.error.URLError):
        raise ValueError("无法读取 Gitee 公开文件") from None
    if len(data) > response_limit:
        raise ValueError("Gitee 公开文件响应超过大小限制")
    record = json.loads(data)
    if missing_ok and record == []:
        return None
    return decode_public_file(record, path, limit)


def verify_public_package(base_url, path, expected):
    for _ in range(6):
        try:
            if download_public(base_url, path, ZIP_LIMIT) == expected:
                return
        except ValueError:
            pass
        time.sleep(2)
    raise ValueError("Gitee 尚未提供与安装包一致的公开下载，索引保持原版本")


def git_commit_push(mirror, relative_path, message):
    git(mirror, "add", "--", relative_path)
    git(mirror, "commit", "-m", message)
    git(mirror, "push", "origin", f"HEAD:refs/heads/{MIRROR_BRANCH}")


def daozai(island, *args):
    subprocess.run([str(island), *map(str, args)], check=True)


def is_official(commit, plugin_id):
    path = ".github/official-plugins.json"
    if not git(ROOT, "ls-tree", commit, "--", path):
        return False
    ids = json.loads(git(ROOT, "show", f"{commit}:{path}"))
    if not isinstance(ids, list) or any(
        not isinstance(item, str) or len(item) > 64 or not PLUGIN_ID.fullmatch(item) for item in ids
    ):
        raise ValueError("官方插件登记必须是插件 ID 列表")
    return plugin_id in ids


def reviewed_description(commit, plugin_id):
    path = ".github/plugin-descriptions.json"
    if not git(ROOT, "ls-tree", commit, "--", path):
        return None
    descriptions = json.loads(git(ROOT, "show", f"{commit}:{path}"))
    if not isinstance(descriptions, dict) or any(
        len(key) > 64 or not PLUGIN_ID.fullmatch(key)
        or not isinstance(description, str) or not description.strip() or len(description) > 1000
        for key, description in descriptions.items()
    ):
        raise ValueError("插件简介登记必须由有效的插件 ID 和 1–1000 字的简介组成")
    return descriptions.get(plugin_id)


def pack_reviewed(workspace, island, plugin_id, channel):
    git(ROOT, "fetch", "origin", "refs/heads/main")
    commit = git(ROOT, "rev-parse", "FETCH_HEAD").decode().strip()
    manifest, files = read_plugin(ROOT, commit, plugin_id)
    material = manifest["runtime"] == "material"
    if material and channel != "preview":
        raise ValueError("GPU 材质仅可发布到 preview 集市")
    maintainers = json.loads(git(ROOT, "show", f"{commit}:.github/plugin-maintainers.json"))
    login = maintainers.get(plugin_id) if isinstance(maintainers, dict) else None
    if not isinstance(login, str) or len(login) > 39 or not LOGIN.fullmatch(login):
        raise ValueError(f"请在 GitHub 主分支的 .github/plugin-maintainers.json 登记 {plugin_id} 的维护者账号后再上架")
    official = is_official(commit, plugin_id)
    description = reviewed_description(commit, plugin_id)
    source = workspace / "package"
    source.mkdir()
    for name, data in files.items():
        path = source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    bundle = workspace / "bundle.zip"
    daozai(island, "--plugin-pack", source / "plugin.json", bundle)
    return commit, manifest["version"], bundle, official, description


def apply_presentation(index, plugin_id, official=False, description=None):
    if not official and description is None:
        return index
    catalog = json.loads(index)
    entry = next(entry for entry in catalog["plugins"] if entry["id"] == plugin_id)
    details = entry.get("presentation") or {}
    if (not official or details.get("official") is True) and (
        description is None or details.get("description") == description
    ):
        return index
    if official:
        details["official"] = True
    if description is not None:
        details["description"] = description
    entry["presentation"] = details
    index = json.dumps(catalog, ensure_ascii=False, indent=2).encode("utf-8")
    if len(index) > CATALOG_LIMIT:
        raise ValueError("集市目录超出大小限制")
    return index


def stage_catalog(bundle, staged, original, island, plugin_id, current, data,
                  official=False, description=None):
    if original is not None:
        previous = next(
            (entry for entry in json.loads(original)["plugins"] if entry["id"] == plugin_id),
            None,
        )
        if previous and version(previous["version"]) >= version(current):
            if (previous["version"] != current or previous["size"] != len(data)
                    or previous["sha256"] != hashlib.sha256(data).hexdigest()):
                raise ValueError("已上架版本不可覆盖，发布新包须提高版本号")
            index = apply_presentation(original, plugin_id, official, description)
            return (index if index != original else None), True
        staged.write_bytes(original)
    daozai(island, "--plugin-submit", bundle, staged)
    index = staged.read_bytes()
    return apply_presentation(index, plugin_id, official, description), False


def read_mirror_file(path, limit):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ValueError("镜像索引和安装包必须为普通文件")
    if path.is_file():
        if path.stat().st_size > limit:
            raise ValueError("镜像索引或安装包超出大小限制")
        return path.read_bytes()
    return None


def write_prepared(directory, name, data):
    path = directory / name
    previous = read_mirror_file(path, max(CATALOG_LIMIT, ZIP_LIMIT))
    if previous is None:
        with path.open("xb") as output:
            output.write(data)
    elif previous != data:
        raise ValueError(f"输出目录里的 {name} 内容不同，请使用新目录")


def metrics_registration(channel, plugin_id, current):
    if (channel not in ("preview", "stable") or len(plugin_id) > 64
            or not PLUGIN_ID.fullmatch(plugin_id)):
        raise ValueError("统计登记的频道或插件 ID 无效")
    version(current)
    return (
        "INSERT INTO metric_plugins (channel, plugin_id) VALUES "
        f"('{channel}', '{plugin_id}') ON CONFLICT(channel, plugin_id) DO NOTHING;\n"
        "INSERT INTO metric_versions (channel, plugin_id, version) VALUES "
        f"('{channel}', '{plugin_id}', '{current}') "
        "ON CONFLICT(channel, plugin_id, version) DO NOTHING;\n"
    ).encode("ascii")


def register_metrics(path, registration):
    path.write_bytes(registration)
    npx = "npx.cmd" if os.name == "nt" else "npx"
    subprocess.run([npx, "wrangler", "d1", "execute", "daozai-market-metrics", "--remote",
                    "--yes", "--file", str(path)], cwd=METRICS_DIR, check=True)


def publish(island, plugin_id, mirror_url, channel, prepare=None, metrics=False):
    base_url = publish_origin(mirror_url)
    with tempfile.TemporaryDirectory(prefix="daozai-market-") as temporary:
        workspace = Path(temporary)
        commit, current, bundle, official, description = pack_reviewed(workspace, island, plugin_id, channel)
        zip_name = f"plugin-{plugin_id}-{current}.zip"
        zip_remote = f"{channel}/{zip_name}"
        catalog_remote = f"{channel}/catalog.json"
        data = bundle.read_bytes()
        registration = metrics_registration(channel, plugin_id, current) if metrics else None

        if prepare is None:
            mirror = workspace / "mirror"
            git(workspace, "clone", "--quiet", "--single-branch", "--branch", MIRROR_BRANCH,
                "--", mirror_url, str(mirror))
            directory = mirror / channel
            if directory.is_symlink():
                raise ValueError("镜像目录必须为普通目录")
            directory.mkdir(exist_ok=True)
            zip_path, catalog = directory / zip_name, directory / "catalog.json"
            previous_zip = read_mirror_file(zip_path, ZIP_LIMIT)
            original = read_mirror_file(catalog, CATALOG_LIMIT)
        else:
            original = download_public(base_url, catalog_remote, CATALOG_LIMIT)
            previous_zip = download_public(base_url, zip_remote, ZIP_LIMIT, missing_ok=True)

        if previous_zip is not None and previous_zip != data:
            raise ValueError("该版本已有不同的安装包，请提高版本号")
        index, catalog_only = stage_catalog(
            bundle, workspace / "catalog.json", original, island, plugin_id, current,
            data, official=official, description=description,
        )
        if catalog_only and previous_zip is None:
            raise ValueError("线上索引已存在但缺少对应安装包，不能仅更新索引")
        if index is None:
            verify_public_package(base_url, zip_remote, data)
            if registration is not None:
                if prepare is None:
                    register_metrics(workspace / "metrics.sql", registration)
                else:
                    prepare.mkdir(parents=True, exist_ok=True)
                    write_prepared(prepare, "metrics.sql", registration)
            print(f"{plugin_id} {current} 已发布")
            return

        if prepare is not None:
            prepare.mkdir(parents=True, exist_ok=True)
            if catalog_only:
                verify_public_package(base_url, zip_remote, data)
                print("仅更新集市目录：沿用已公开的安装包，不重新上传 ZIP。")
            else:
                write_prepared(prepare, zip_name, data)
            write_prepared(prepare, "catalog.json", index)
            if registration is not None:
                write_prepared(prepare, "metrics.sql", registration)
            print(f"{plugin_id} {current} 已准备，尚未发布")
            print(f"审定提交 {commit}")
            print(f"安装包 SHA-256 {hashlib.sha256(data).hexdigest()}")
            print(f"输出目录 {prepare}")
            return

        if previous_zip is None:
            zip_path.write_bytes(data)
            git_commit_push(mirror, zip_remote, f"同步 {plugin_id} {current} 安装包")
        verify_public_package(base_url, zip_remote, data)
        if registration is not None:
            register_metrics(workspace / "metrics.sql", registration)
        catalog.write_bytes(index)
        action = "更新目录" if catalog_only else "上架"
        git_commit_push(mirror, catalog_remote, f"{action} {plugin_id} {current}")
        print(f"{plugin_id} {current} 已发布到 {channel} 目录")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plugin_id")
    parser.add_argument("--island", type=Path, required=True, help="岛仔作者命令可执行文件")
    parser.add_argument("--mirror", required=True, help="Gitee 公开镜像仓库 Git 地址")
    parser.add_argument("--channel", choices=("preview", "stable"), required=True)
    parser.add_argument("--prepare", type=Path, help="导出待发布文件的目录")
    parser.add_argument("--metrics", action="store_true", help="推送索引前登记统计版本，导出模式生成 metrics.sql")
    options = parser.parse_args(argv)
    try:
        publish(options.island.resolve(strict=True), options.plugin_id, options.mirror,
                options.channel, options.prepare, options.metrics)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))


if __name__ == "__main__":
    main()

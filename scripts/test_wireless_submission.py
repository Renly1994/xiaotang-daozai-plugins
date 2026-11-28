"""Native wireless source submission contract; no network or device reads."""
import binascii
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parent))
import submission


def manifest(**fields):
    return {
        "id": "example.wireless-source", "name": "设备电量", "author": "测试",
        "version": "1.0.0", "api": 1, "runtime": "js", "owner": "wireless",
        "entry": "main.js", "cover": "cover.png", "dataVersion": 1,
        "capabilities": ["wireless.devices", "timer", "settings", "storage"],
        "permissions": {"source.read": "loopback"}, "settings": [],
        "refreshSeconds": 60, **fields,
    }


def png():
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\0\0\0\0\xff")) + chunk(b"IEND", b""))


class WirelessSubmissionTests(unittest.TestCase):
    def test_accepts_loopback_with_bounded_capabilities(self):
        submission.check_script(manifest())

    def test_accepts_file_and_maximum_refresh_interval(self):
        submission.check_script(manifest(permissions={"source.read": "file"}, refreshSeconds=86400))

    def test_accepts_minimal_readonly_source(self):
        submission.check_script(manifest(capabilities=["wireless.devices"]))

    def test_rejects_source_capability_on_other_owner(self):
        for owner, required in (("tasks", "card"), ("status", "status.page"), ("quota", "quota.source")):
            with self.subTest(owner=owner), self.assertRaisesRegex(ValueError, "wireless.devices"):
                submission.check_script(manifest(owner=owner, capabilities=[required, "wireless.devices"]))

    def test_rejects_wireless_without_native_output(self):
        with self.assertRaisesRegex(ValueError, "wireless.devices"):
            submission.check_script(manifest(capabilities=["timer"]))

    def test_rejects_unrelated_ui_and_action_capabilities(self):
        for capability in ("status.page", "status.canvas", "island.pinned", "action", "event", "notice", "card", "calendar.marker"):
            with self.subTest(capability=capability), self.assertRaisesRegex(ValueError, "无线设备来源"):
                submission.check_script(manifest(capabilities=["wireless.devices", capability]))

    def test_rejects_missing_https_or_combined_permissions(self):
        for permissions in ({}, None, {"source.read": "https"}, {"source.read": ["file", "loopback"]},
                            {"source.read": "file", "other": True}):
            with self.subTest(permissions=permissions), self.assertRaisesRegex(ValueError, "本机只读来源"):
                submission.check_script(manifest(permissions=permissions))

    def test_rejects_network_and_attribution_on_local_source(self):
        for source in ("file", "loopback"):
            for extra in ({"network": {"hosts": ["example.test"]}}, {"attribution": {"label": "来源"}}):
                with self.subTest(source=source, extra=extra), self.assertRaisesRegex(ValueError, "network 或 attribution"):
                    submission.check_script(manifest(permissions={"source.read": source}, **extra))

    def test_rejects_refresh_outside_existing_timer_bounds(self):
        for value in (59, 86401, True, 60.5):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "refreshSeconds"):
                submission.check_script(manifest(refreshSeconds=value))

    def test_rejects_status_layout_or_navigation_for_native_source(self):
        for fields, message in (({"statusLayout": {"components": [{"type": "state"}]}}, "status.page"),
                                ({"navigationIcon": {"path": "M0 0 H1", "background": "#112233"}}, "navigationIcon")):
            with self.subTest(fields=fields), self.assertRaisesRegex(ValueError, message):
                submission.check_script(manifest(**fields))

    def test_existing_status_and_quota_sources_keep_their_boundaries(self):
        for owner, output, source in (("status", "status.page", "file"),
                                      ("status", "status.page", "loopback"),
                                      ("quota", "quota.source", "loopback")):
            submission.check_script(manifest(owner=owner, capabilities=[output, "timer"],
                                             permissions={"source.read": source}))
        with self.assertRaisesRegex(ValueError, "permissions"):
            submission.check_script(manifest(owner="quota", capabilities=["quota.source"],
                                             permissions={"source.read": "file"}))

    def read_package(self, extras=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = {"plugin.json": json.dumps(manifest(), ensure_ascii=False).encode("utf-8"),
                     "main.js": b"function refresh() { return {wireless: []}; }", "cover.png": png(),
                     "README.md": b"Bridge source and manual start/stop instructions.", "LICENSE": b"MIT"}
            files.update(extras or {})
            index = {name: (f"oid-{i}", data) for i, (name, data) in enumerate(files.items())}
            prefix = "plugins/example.wireless-source/"

            def fake_git(_repo, *args):
                if args == ("ls-tree", "-rlz", "HEAD", "--", prefix):
                    return b"\0".join(f"100644 blob {oid} {len(data)}\t{prefix}{name}".encode()
                                       for name, (oid, data) in index.items()) + b"\0"
                if args[:2] == ("cat-file", "blob"):
                    return next(data for oid, data in index.values() if oid == args[2])
                raise AssertionError(args)

            with patch.object(submission, "git", fake_git):
                return submission.read_plugin(root, "HEAD", "example.wireless-source")

    def test_native_source_package_is_read_and_keeps_documentation_out_of_payload(self):
        value, files = self.read_package()
        self.assertEqual(value["owner"], "wireless")
        self.assertEqual(set(files), {"plugin.json", "main.js", "cover.png"})

    def test_bridge_executables_are_not_added_to_install_payload(self):
        for name in ("bridge.py", "bridge.exe", "helper.dll"):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "未支持的文件"):
                self.read_package({name: b"source or executable"})


if __name__ == "__main__":
    unittest.main(verbosity=2)

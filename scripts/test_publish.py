"""Exercise publisher branches offline; no push or remote service is used."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import publish

PLUGIN = "demo.example"
VERSION = "1.2.3"
BUNDLE = b"reviewed package"
DESCRIPTION = "经过维护者审阅的社区插件简介"
ZIP_NAME = f"plugin-{PLUGIN}-{VERSION}.zip"
ZIP_REMOTE = f"stable/{ZIP_NAME}"
CATALOG_REMOTE = "stable/catalog.json"


def entry(data=BUNDLE):
    return {"id": PLUGIN, "version": VERSION, "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(), "download_url": "unchanged",
            "presentation": {"label": "keep", "official": False}}


def catalog(*entries):
    return json.dumps({"plugins": entries}).encode()


class PublishPresentationTests(unittest.TestCase):
    def test_community_override_preserves_badge_and_transport(self):
        original = entry()
        updated = json.loads(publish.apply_presentation(
            catalog(original), PLUGIN, description=DESCRIPTION
        ))["plugins"][0]
        self.assertEqual(updated, {**original, "presentation": {
            **original["presentation"], "description": DESCRIPTION,
        }})

    def test_official_badge_and_description_remain_independent(self):
        original = catalog(entry())
        updated = publish.apply_presentation(original, PLUGIN, official=True)
        self.assertTrue(json.loads(updated)["plugins"][0]["presentation"]["official"])
        self.assertEqual(publish.apply_presentation(updated, PLUGIN), updated)

    def run_release(self, previous, previous_zip, *, mode="prepare", description=DESCRIPTION):
        with tempfile.TemporaryDirectory() as d:
            output = Path(d) / "output"
            island = Path(d) / "daozai.exe"
            island.touch()
            remote = {ZIP_REMOTE: previous_zip, CATALOG_REMOTE: previous}
            pushes = []

            def fetch(_url, path, _limit, missing_ok=False):
                if path == CATALOG_REMOTE and previous is None:
                    # The published mirror already has a catalog; a first plugin
                    # starts from an empty catalog, not from a missing document.
                    return catalog()
                return remote[path]

            def pack(workspace, *_):
                bundle = workspace / "bundle.zip"
                bundle.write_bytes(BUNDLE)
                return "reviewed-commit", VERSION, bundle, False, description

            def submit(_island, command, _bundle, index):
                self.assertEqual(command, "--plugin-submit")
                index.write_bytes(catalog(entry()))

            def git(workspace, command, *_args):
                self.assertEqual(command, "clone")
                mirror = workspace / "mirror" / "stable"
                mirror.mkdir(parents=True)
                for name, value in remote.items():
                    if value is not None:
                        (mirror / name.removeprefix("stable/")).write_bytes(value)

            def commit_push(mirror, relpath, _message):
                pushes.append((relpath, (mirror / relpath).read_bytes()))

            with patch.object(publish, "download_public", side_effect=fetch), \
                    patch.object(publish, "pack_reviewed", side_effect=pack), \
                    patch.object(publish, "daozai", side_effect=submit) as native, \
                    patch.object(publish, "git", side_effect=git), \
                    patch.object(publish, "git_commit_push", side_effect=commit_push), \
                    patch.object(publish, "verify_public_package") as verified:
                command = [PLUGIN, "--island", str(island), "--mirror",
                           "https://gitee.com/owner/mirror", "--channel", "stable"]
                if mode == "prepare":
                    command += ["--prepare", str(output)]
                publish.main(command)
            files = {p.name: p.read_bytes() for p in output.iterdir()} if output.exists() else {}
            return files, pushes, native.call_count, verified.call_count

    def test_prepare_new_community_version_exports_zip_and_catalog(self):
        files, pushes, native_calls, _ = self.run_release(None, None)
        self.assertEqual(set(files), {ZIP_NAME, "catalog.json"})
        self.assertEqual(files[ZIP_NAME], BUNDLE)
        self.assertEqual(json.loads(files["catalog.json"])["plugins"][0]["presentation"],
                         {"official": False, "label": "keep", "description": DESCRIPTION})
        self.assertEqual((pushes, native_calls), ([], 1))

    def test_prepare_same_version_exports_catalog_only(self):
        files, pushes, native_calls, verified = self.run_release(catalog(entry()), BUNDLE)
        self.assertEqual(set(files), {"catalog.json"})
        self.assertEqual((pushes, native_calls, verified), ([], 0, 1))

    def test_live_same_version_commits_catalog_only(self):
        files, pushes, native_calls, verified = self.run_release(catalog(entry()), BUNDLE, mode="live")
        self.assertEqual([name for name, _ in pushes], [CATALOG_REMOTE])
        self.assertEqual(json.loads(pushes[0][1])["plugins"][0]["presentation"]["description"],
                         DESCRIPTION)
        self.assertEqual((files, native_calls, verified), ({}, 0, 1))

    def test_same_version_missing_zip_is_not_recreated(self):
        for mode in ("prepare", "live"):
            with self.subTest(mode=mode), self.assertRaisesRegex(SystemExit, '缺少对应安装包'):
                self.run_release(catalog(entry()), None, mode=mode)

    def test_same_version_different_zip_is_rejected(self):
        with self.assertRaisesRegex(SystemExit, '不同的安装包'):
            self.run_release(catalog(entry()), b"other")

    def test_same_version_metadata_noop_does_not_generate_artifacts(self):
        same = entry()
        same["presentation"]["description"] = DESCRIPTION
        self.assertEqual(self.run_release(catalog(same), BUNDLE), ({}, [], 0, 1))

    def test_reviewed_description_metadata_is_read_for_community(self):
        with patch.object(publish, "git", side_effect=[
            b"tracked", json.dumps({PLUGIN: DESCRIPTION}).encode(),
        ]):
            self.assertEqual(publish.reviewed_description("reviewed-commit", PLUGIN), DESCRIPTION)


if __name__ == "__main__":
    unittest.main()

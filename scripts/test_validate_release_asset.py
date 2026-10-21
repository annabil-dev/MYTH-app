#!/usr/bin/env python3
"""Offline unit tests for Android publish-time FCM gate."""
import io
import unittest
import zipfile

from validate_release_asset import validate_apk

GOOD_HTML = b'''<!doctype html><html><body>
<header data-app-version="v0.1.7"></header>
<div id="page"></div><nav id="mobileNav"></nav><button data-action="menu"></button>
<script>
function renderSettings(){return "settings";}
function renderOverview(){return "overview";}
function render(){return renderOverview();}
render();
</script></body></html>'''


def make_apk(html=GOOD_HTML):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as apk:
        apk.writestr("AndroidManifest.xml", b"test manifest only")
        apk.writestr("assets/index.html", html)
        apk.writestr("padding", b"X" * 55_000)
    return output.getvalue()


class ReleaseQaTests(unittest.TestCase):
    def test_valid_apk_ui(self):
        self.assertEqual(64, len(validate_apk(make_apk(), "0.1.7")))

    def test_syntax_error_blocks_notification(self):
        malformed = GOOD_HTML.replace(b'return "settings";', b'return `bad${x<`;')
        with self.assertRaisesRegex(ValueError, "syntax invalid"):
            validate_apk(make_apk(malformed), "0.1.7")

    def test_wrong_expected_digest_blocks_notification(self):
        with self.assertRaisesRegex(ValueError, "SHA-256 differs"):
            validate_apk(make_apk(), "0.1.7", "0" * 64)

    def test_mismatched_version_blocks_notification(self):
        with self.assertRaisesRegex(ValueError, "Missing Android UI"):
            validate_apk(make_apk(), "0.1.6")

    def test_missing_asset_blocks_notification(self):
        with self.assertRaisesRegex(ValueError, "Invalid APK"):
            validate_apk(b"X" * 55_000, "0.1.7")


if __name__ == "__main__":
    unittest.main()

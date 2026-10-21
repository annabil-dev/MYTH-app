#!/usr/bin/env python3
"""Fail closed before FCM push if published MYTH Android APK contains unparseable UI JS.

Checks GitHub asset SHA-256 digest, ZIP content, exact UI version markers, and
inline JavaScript syntax. No credentials or downloaded file bytes are logged.
This is an additional release QA gate; signing identity is verified separately.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

REPO = "annabil-dev/MYTH-app"
TAG_RE = re.compile(r"^ui-preview-v(0\.1\.\d+)$")
DIGEST_RE = re.compile(r"^sha256:([a-f0-9]{64})$")
MAX_BYTES = 32 * 1024 * 1024


def validate_apk(data, version, expected_sha=None):
    if len(data) > MAX_BYTES or len(data) < 50000:
        raise ValueError("APK size outside safe limits")
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha and digest != expected_sha:
        raise ValueError("Downloaded APK SHA-256 differs from GitHub asset digest")
    try:
        with zipfile.ZipFile(BytesIO(data)) as apk:
            info = apk.getinfo("assets/index.html")
            if info.file_size > 256_000:
                raise ValueError("HTML entry unexpectedly large")
            html = apk.read(info).decode("utf-8")
            if "AndroidManifest.xml" not in apk.namelist():
                raise ValueError("Missing AndroidManifest.xml")
    except (zipfile.BadZipFile, KeyError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid APK archive or missing UI asset") from exc

    markers = [
        f'data-app-version="v{version}"',
        'id="page"', 'id="mobileNav"',
        'data-action="menu"', 'function renderSettings()',
        'function renderOverview()', 'render();'
    ]
    if any(marker not in html for marker in markers):
        raise ValueError("Missing Android UI version, renderer or navigation markers")
    scripts = re.findall(r"<script>(.*?)</script>", html, re.DOTALL)
    if len(scripts) != 1:
        raise ValueError("Expected one inline MYTH app script")
    result = subprocess.run(
        ["node", "--check", "-"], input=scripts[0].encode("utf-8"),
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15,
        check=False
    )
    if result.returncode != 0:
        raise ValueError("Android MYTH UI JavaScript syntax invalid; FCM push blocked")
    return digest


def github_json(path, token):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "MYTH-App-release-validator",
            **({"Authorization": "Bearer " + token} if token else {}),
        }
    )
    with urllib.request.urlopen(req, timeout=18) as resp:
        return json.load(resp)


def remote_check(event_path):
    event = json.loads(Path(event_path).read_text(encoding="utf-8"))
    release = event.get("release") or {}
    tag = release.get("tag_name", "")
    match = TAG_RE.fullmatch(tag)
    if (event.get("action") != "published" or
            (event.get("repository") or {}).get("full_name") != REPO or
            not match or release.get("draft") is not False or
            release.get("prerelease") is not True):
        print("SKIP: not an Android UI prerelease")
        return
    version = match.group(1)
    name = f"MYTH-Android-UI-Preview-v{version}.apk"
    token = os.environ.get("GITHUB_TOKEN", "")
    for attempt in range(8):
        item = github_json(f"/repos/{REPO}/releases/tags/{tag}", token)
        assets = [a for a in item.get("assets", []) if a.get("name") == name]
        if assets and DIGEST_RE.fullmatch(assets[0].get("digest") or ""):
            asset = assets[0]
            break
        if attempt < 7:
            time.sleep(2)
    else:
        raise ValueError("No finalized GitHub Android asset and SHA digest")
    expected_sha = DIGEST_RE.fullmatch(asset["digest"]).group(1)
    if not 50_000 <= asset.get("size", -1) <= MAX_BYTES:
        raise ValueError("Invalid published APK size")
    req = urllib.request.Request(asset["browser_download_url"], headers={
        "User-Agent": "MYTH-App-release-validator"
    })
    with urllib.request.urlopen(req, timeout=50) as resp:
        data = resp.read(MAX_BYTES + 1)
    actual = validate_apk(data, version, expected_sha)
    print(f"PASS: published {name}; SHA-256 {actual}; UI JS parses; FCM may proceed")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--local-apk", type=Path)
    cli.add_argument("--version")
    opts = cli.parse_args()
    try:
        if opts.local_apk:
            if not opts.version:
                raise ValueError("--version required with --local-apk")
            sha = validate_apk(opts.local_apk.read_bytes(), opts.version)
            print(f"PASS: local APK UI JS parses; SHA-256 {sha}")
        else:
            remote_check(os.environ["GITHUB_EVENT_PATH"])
    except (ValueError, OSError, subprocess.SubprocessError, urllib.error.URLError) as exc:
        print("FAIL: MYTH Android APK release QA: " + str(exc), file=sys.stderr)
        sys.exit(1)

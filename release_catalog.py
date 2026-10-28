"""Explicit test/stable GitHub release channels and safe downgrade catalog.

No automatic update or shell execution. Retain the legacy 0.5.2 release
as a TEST rollback choice, because it is the first GameMode Hub identity.
"""
import re

ASSET_NAME = "GameMode-Hub.zip"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/GameMode-Hub/releases?per_page=50"
DOWNLOAD_PREFIX = "https://github.com/BlueGalaxySlime/GameMode-Hub/releases/download/"
CHANNELS = ("test", "stable")
_STABLE_MIN = (0, 6, 0)
_TEST_MIN = (0, 5, 3)
_TAG = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)(?:-test\.(\d+))?$")


def validate_channel(channel):
    if not isinstance(channel, str) or channel not in CHANNELS:
        raise ValueError("Nieznany kanal aktualizacji.")
    return channel


def version(value):
    match = _TAG.fullmatch(value or "") if isinstance(value, str) else None
    if not match:
        return None
    major, minor, patch = map(int, match.groups()[:3])
    test_number = match.group(4)
    return (major, minor, patch, 0 if test_number else 1, int(test_number or 0))


def catalog(releases, channel, installed):
    validate_channel(channel)
    current = version(installed)
    if current is None:
        raise ValueError("Nieprawidlowa wersja zainstalowanej wtyczki.")
    if not isinstance(releases, list):
        raise ValueError("Nieprawidlowa lista wydan GitHub.")
    selected = []
    for release in releases[:50]:
        if not isinstance(release, dict) or release.get("draft"):
            continue
        tag = release.get("tag_name")
        parsed = version(tag)
        if parsed is None:
            continue
        numeric = parsed[:3]
        if channel == "stable":
            if release.get("prerelease") or parsed[3] != 1 or numeric < _STABLE_MIN:
                continue
        elif not ((release.get("prerelease") is True and parsed[3] == 0 and numeric >= _TEST_MIN)
                   or (tag == "v0.5.2" and not release.get("prerelease"))):
            continue
        assets = release.get("assets")
        if not isinstance(assets, list):
            continue
        asset = next((entry for entry in assets
                      if isinstance(entry, dict) and entry.get("name") == ASSET_NAME), None)
        if asset is None:
            continue
        expected_url = DOWNLOAD_PREFIX + tag + "/" + ASSET_NAME
        digest = asset.get("digest")
        if asset.get("browser_download_url") != expected_url:
            continue
        if not isinstance(digest, str) or not re.fullmatch(r"sha256:[a-fA-F0-9]{64}", digest):
            continue
        comparison = "downgrade" if parsed < current else "upgrade" if parsed > current else "installed"
        selected.append({
            "version": tag.removeprefix("v"),
            "url": expected_url,
            "sha256": digest[7:].lower(),
            "action": comparison,
            "legacy": tag == "v0.5.2",
        })
    selected.sort(key=lambda item: version(item["version"]), reverse=True)
    return selected

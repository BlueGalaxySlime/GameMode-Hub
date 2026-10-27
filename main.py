"""SteamHub: check verified release metadata; installation is delegated to Decky Loader."""
import asyncio
import json
import re
import urllib.error
import urllib.request

CURRENT_VERSION = "0.2.0"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/SteamOS-Hub/releases/latest"
ASSET_NAME = "SteamHub.zip"


def _version(value):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", value or "")
    return tuple(map(int, match.groups())) if match else None


def _fetch_latest_release():
    request = urllib.request.Request(
        RELEASES_API,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "SteamHub/0.2.0"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        data = json.load(response)
    latest = str(data.get("tag_name", ""))
    asset = next((a for a in data.get("assets", []) if a.get("name") == ASSET_NAME), None)
    digest = str(asset.get("digest") or "") if asset else ""
    sha256 = digest[7:] if re.fullmatch(r"sha256:[0-9a-fA-F]{64}", digest) else None
    url = asset.get("browser_download_url") if asset else None
    if url and not url.startswith("https://github.com/BlueGalaxySlime/SteamOS-Hub/releases/download/"):
        url = None
    newer = _version(latest) is not None and _version(latest) > _version(CURRENT_VERSION)
    return {"current": CURRENT_VERSION, "latest": latest.lstrip("v"), "url": url,
            "sha256": sha256, "available": bool(newer and url and sha256),
            "status": "ok"}


class Plugin:
    async def _main(self):
        pass

    async def check_updates(self):
        try:
            return await asyncio.to_thread(_fetch_latest_release)
        except urllib.error.HTTPError as error:
            status = "no_releases" if error.code == 404 else "error"
        except (OSError, ValueError, TimeoutError):
            status = "error"
        return {"current": CURRENT_VERSION, "latest": None, "url": None,
                "sha256": None, "available": False, "status": status}

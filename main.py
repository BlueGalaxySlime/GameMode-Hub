"""SteamOS-Hub backend: read-only release check, no privileged actions."""
import asyncio
import json
import urllib.error
import urllib.request

CURRENT_VERSION = "0.1.0"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/SteamOS-Hub/releases/latest"


def _fetch_latest_release():
    request = urllib.request.Request(
        RELEASES_API,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "SteamOS-Hub/0.1.0"},
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        data = json.load(response)
    return {"current": CURRENT_VERSION, "latest": str(data.get("tag_name", "")).lstrip("v"),
            "url": str(data.get("html_url", "")), "status": "ok"}


class Plugin:
    async def _main(self):
        pass

    async def check_updates(self):
        try:
            return await asyncio.to_thread(_fetch_latest_release)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return {"current": CURRENT_VERSION, "latest": None, "url": None, "status": "no_releases"}
            return {"current": CURRENT_VERSION, "latest": None, "url": None, "status": "error"}
        except (OSError, ValueError, TimeoutError):
            return {"current": CURRENT_VERSION, "latest": None, "url": None, "status": "error"}

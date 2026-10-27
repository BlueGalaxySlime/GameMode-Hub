"""SteamHub release checker. Installation is delegated to Decky Loader."""
import asyncio
import json
import re
import socket
import time
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
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "SteamHub/0.2.0",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                data = json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(attempt + 1)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, socket.timeout):
            if attempt < 2:
                time.sleep(attempt + 1)
                continue
            raise

    latest = str(data.get("tag_name", ""))
    asset = next((a for a in data.get("assets", []) if a.get("name") == ASSET_NAME), None)
    digest = str(asset.get("digest") or "") if asset else ""
    sha256 = digest[7:] if re.fullmatch(r"sha256:[0-9a-fA-F]{64}", digest) else None
    url = asset.get("browser_download_url") if asset else None
    if url and not url.startswith("https://github.com/BlueGalaxySlime/SteamOS-Hub/releases/download/"):
        url = None
    parsed_latest = _version(latest)
    newer = parsed_latest is not None and parsed_latest > _version(CURRENT_VERSION)
    return {
        "current": CURRENT_VERSION, "latest": latest.lstrip("v"), "url": url,
        "sha256": sha256, "available": bool(newer and url and sha256),
        "status": "ok", "error": None,
    }


class Plugin:
    async def _main(self):
        pass

    async def check_updates(self):
        try:
            return await asyncio.to_thread(_fetch_latest_release)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                status, detail = "no_releases", "GitHub nie znalazł opublikowanego wydania (HTTP 404)."
            elif error.code in (403, 429):
                status, detail = "error", f"GitHub ograniczył liczbę żądań (HTTP {error.code}). Spróbuj później."
            else:
                status, detail = "error", f"GitHub zwrócił błąd HTTP {error.code}."
        except (urllib.error.URLError, OSError, TimeoutError) as error:
            status, detail = "error", f"Błąd połączenia z GitHub: {getattr(error, 'reason', str(error))}"
        except (ValueError, TypeError, KeyError) as error:
            status, detail = "error", f"Nieprawidłowa odpowiedź GitHub: {type(error).__name__}."
        return {
            "current": CURRENT_VERSION, "latest": None, "url": None,
            "sha256": None, "available": False, "status": status, "error": detail,
        }

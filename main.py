"""GameMode Hub release checker. Installation is delegated to Decky Loader."""
import asyncio
import json
import re
import ssl
import sys
from pathlib import Path
import urllib.error
import urllib.request

# Decky executes main.py via importlib.spec_from_file_location in a sandbox
# and adds only DECKY_PLUGIN_DIR/py_modules to sys.path. The plugin root is
# NOT automatically importable. Register it before importing bundled modules,
# otherwise the entire Python backend exits at startup (all RPCs time out).
_PLUGIN_ROOT = str(Path(__file__).resolve().parent)
if _PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, _PLUGIN_ROOT)

from hub_settings import get_selected_addons, set_selected_addons, get_update_channel, set_update_channel
from release_catalog import RELEASES_API as RELEASE_CATALOG_API, catalog, validate_channel
from file_manager import listing as list_files, create_folder, rename_entry, paste_entry

CURRENT_VERSION = "0.5.8"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/GameMode-Hub/releases/latest"
ASSET_NAME = "GameMode-Hub.zip"


def _version(value):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?", value or "")
    return (*map(int, match.groups()[:3]), 0 if match.group(4) else 1) if match else None


def _ssl_context():
    """Use an explicit trusted CA bundle when Decky's Python lacks CA paths."""
    candidates = []
    try:
        import certifi
        candidates.append(certifi.where())
    except ImportError:
        pass
    candidates.extend((
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/ssl/cert.pem",
        "/etc/pki/tls/certs/ca-bundle.crt",
    ))
    for path in candidates:
        if path and Path(path).is_file():
            try:
                context = ssl.create_default_context(cafile=path)
                context.set_alpn_protocols(["http/1.1"])
                return context
            except (OSError, ssl.SSLError):
                continue
    raise RuntimeError(
        "Brak zaufanego zestawu certyfikatów CA w środowisku Decky. "
        "Zainstaluj certifi dla Pythona Decky lub udostępnij systemowy plik CA."
    )


def _fetch_releases(channel):
    """One bounded request per explicit click in the update panel."""
    validate_channel(channel)
    request = urllib.request.Request(
        RELEASE_CATALOG_API,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "GameModeHub/" + CURRENT_VERSION,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=7, context=_ssl_context()) as response:
        data = json.load(response)
    return catalog(data, channel, CURRENT_VERSION)


def _fetch_latest_release():
    """Backward-compatible check result, matching the selected update channel."""
    releases = _fetch_releases(get_update_channel())
    newest = next((entry for entry in releases if entry["action"] == "upgrade"), None)
    return {
        "current": CURRENT_VERSION,
        "latest": newest["version"] if newest else None,
        "url": newest["url"] if newest else None,
        "sha256": newest["sha256"] if newest else None,
        "available": newest is not None,
        "status": "ok" if releases else "no_releases",
        "error": None if releases else "Brak wydan w wybranym kanale.",
    }


class Plugin:
    def __init__(self):
        # Load PTY engine only when actually needed. An engine import error
        # must never prevent Decky from loading SteamHub's updater/settings.
        self._terminal = None

    async def terminal_ping(self):
        # Lightweight handshake works even when the Linux PTY engine is broken.
        return {"ok": True, "version": CURRENT_VERSION, "protocol": 2, "terminal_enabled": False}

    async def terminal_start(self, cols=80, rows=24):
        # Hardware fail-safe: even a stale Steam/Decky frontend must not start
        # PTYs while the reported Steam UI reset is being investigated.
        raise RuntimeError(
            "Terminal GameMode Hub tymczasowo wylaczony: ryzyko restartu Gaming Mode."
        )

    # Fail closed on every legacy PTY method as well as start(). We no longer
    # package terminal_core in the Decky ZIP, so none may lazy-import it.
    async def terminal_read(self, session_id):
        raise RuntimeError("Terminal wylaczony w trybie bezpiecznym.")

    async def terminal_write(self, session_id, data):
        raise RuntimeError("Terminal wylaczony w trybie bezpiecznym.")

    async def terminal_resize(self, session_id, cols, rows):
        raise RuntimeError("Terminal wylaczony w trybie bezpiecznym.")

    async def terminal_close(self, session_id):
        raise RuntimeError("Terminal wylaczony w trybie bezpiecznym.")

    async def _unload(self):
        pass

    async def get_selected_addons(self):
        return await asyncio.to_thread(get_selected_addons)

    async def set_selected_addons(self, names):
        return await asyncio.to_thread(set_selected_addons, names)

    async def get_update_channel(self):
        return await asyncio.to_thread(get_update_channel)

    async def set_update_channel(self, channel):
        validate_channel(channel)
        return await asyncio.to_thread(set_update_channel, channel)

    async def list_releases(self, channel):
        validate_channel(channel)
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_releases, channel), timeout=10
        )

    async def files_list(self, path=None, hidden=False, offset=0, sort_by="name", descending=False):
        return await asyncio.to_thread(list_files, path, hidden, offset, sort_by, descending)

    async def files_mkdir(self, folder, name):
        return await asyncio.to_thread(create_folder, folder, name)

    async def files_rename(self, source, name):
        return await asyncio.to_thread(rename_entry, source, name)

    async def files_paste(self, source, destination, mode):
        return await asyncio.to_thread(paste_entry, source, destination, mode)

    async def _main(self):
        pass

    async def check_updates(self):
        try:
            return await asyncio.wait_for(asyncio.to_thread(_fetch_latest_release), timeout=10)
        except asyncio.TimeoutError:
            status, detail = "error", "Przekroczono limit czasu sprawdzania GitHub. Spróbuj ponownie."
        except urllib.error.HTTPError as error:
            if error.code == 404:
                status, detail = "no_releases", "GitHub nie znalazł opublikowanego wydania (HTTP 404)."
            elif error.code in (403, 429):
                status, detail = "error", f"GitHub ograniczył liczbę żądań (HTTP {error.code}). Spróbuj później."
            else:
                status, detail = "error", f"GitHub zwrócił błąd HTTP {error.code}."
        except (urllib.error.URLError, OSError, TimeoutError) as error:
            status, detail = "error", f"Błąd połączenia z GitHub: {getattr(error, 'reason', str(error))}"
        except RuntimeError as error:
            status, detail = "error", str(error)
        except (ValueError, TypeError, KeyError) as error:
            status, detail = "error", f"Nieprawidłowa odpowiedź GitHub: {type(error).__name__}."
        return {
            "current": CURRENT_VERSION, "latest": None, "url": None,
            "sha256": None, "available": False, "status": status, "error": detail,
        }

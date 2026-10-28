"""SteamHub release checker. Installation is delegated to Decky Loader."""
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

from hub_settings import get_selected_addons, set_selected_addons

CURRENT_VERSION = "0.4.14"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/SteamOS-Hub/releases/latest"
ASSET_NAME = "SteamHub.zip"


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


def _fetch_latest_release():
    request = urllib.request.Request(
        RELEASES_API,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "SteamHub/0.4.14",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    # One network request per manual click. Never retry automatically.
    with urllib.request.urlopen(request, timeout=6, context=_ssl_context()) as response:
        data = json.load(response)

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
    def __init__(self):
        # Load PTY engine only when actually needed. An engine import error
        # must never prevent Decky from loading SteamHub's updater/settings.
        self._terminal = None

    def _engine(self):
        if self._terminal is None:
            from terminal_core import TerminalService
            self._terminal = TerminalService()
        return self._terminal

    async def terminal_ping(self):
        # Lightweight handshake works even when the Linux PTY engine is broken.
        return {"ok": True, "version": CURRENT_VERSION, "protocol": 2, "terminal_enabled": False}

    async def terminal_start(self, cols=80, rows=24):
        # Hardware fail-safe: even a stale Steam/Decky frontend must not start
        # PTYs while the reported Steam UI reset is being investigated.
        raise RuntimeError(
            "Terminal SteamHub tymczasowo wylaczony: ryzyko restartu Gaming Mode."
        )

    async def terminal_read(self, session_id):
        return await asyncio.to_thread(self._engine().read, session_id)

    async def terminal_write(self, session_id, data):
        return await asyncio.to_thread(self._engine().write, session_id, data)

    async def terminal_resize(self, session_id, cols, rows):
        return await asyncio.to_thread(self._engine().resize, session_id, cols, rows)

    async def terminal_close(self, session_id):
        return await asyncio.to_thread(self._engine().close, session_id)

    async def _unload(self):
        if self._terminal is not None:
            await asyncio.to_thread(self._terminal.close_all)

    async def get_selected_addons(self):
        return await asyncio.to_thread(get_selected_addons)

    async def set_selected_addons(self, names):
        return await asyncio.to_thread(set_selected_addons, names)

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

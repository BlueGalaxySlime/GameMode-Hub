"""SteamHub release checker. Installation is delegated to Decky Loader."""
import asyncio
import json
import re
import ssl
from pathlib import Path
import urllib.error
import urllib.request

CURRENT_VERSION = "0.3.3"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/SteamOS-Hub/releases/latest"
ASSET_NAME = "SteamHub.zip"


def _version(value):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", value or "")
    return tuple(map(int, match.groups())) if match else None


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
            "User-Agent": "SteamHub/0.3.3",
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
    async def _main(self):
        pass

    async def check_updates(self):
        try:
            return await asyncio.wait_for(asyncio.to_thread(_fetch_latest_release), timeout=10)
        except asyncio.TimeoutError:
            status, detail = "error", "Upłynął czas oczekiwania na GitHub. Spróbuj ponownie."
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

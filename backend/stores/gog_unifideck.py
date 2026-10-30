"""Explicit, read-only GOG session link to an installed Unifideck account.

This is a source-backed link, not an OAuth client or an independent GOG login.
No token is written to GameMode Hub files, returned by RPC, or logged.
The link stops working if Unifideck's encrypted token file disappears.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import stat
import sys
import tempfile
import urllib.error
import urllib.request

_HOME = Path(os.environ.get("DECKY_USER_HOME") or Path.home())
_SOURCE = _HOME / ".config" / "unifideck" / "gog_token.json"
_LINK = _HOME / ".config" / "gamemodehub" / "store_links.json"
_MAGIC = b"UFD1"
_SALT = b"unifideck-secure-token-store-v1!"
_GOG_LIBRARY = "https://embed.gog.com/account/getFilteredProducts?mediaType=1&page="
_MAX_SOURCE_BYTES = 65536
_MAX_PAGES = 5
_MAX_GAMES = 250


def _read_source():
    """Read only the one well-known owner-only token file; reject symlinks."""
    fd = os.open(_SOURCE, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid():
            raise PermissionError("GOG session owner mismatch")
        if info.st_mode & 0o077:
            raise PermissionError("GOG session permissions are not private")
        if info.st_size < 32 or info.st_size > _MAX_SOURCE_BYTES:
            raise ValueError("Unsupported GOG token file size")
        with os.fdopen(fd, "rb", closefd=False) as f:
            data = f.read(_MAX_SOURCE_BYTES + 1)
        if not data.startswith(_MAGIC) or len(data) > _MAX_SOURCE_BYTES:
            raise ValueError("Only encrypted UFD1 sessions are supported")
        return data
    finally:
        os.close(fd)


def _linked():
    try:
        data = json.loads(_LINK.read_text(encoding="utf-8"))
        return isinstance(data, dict) and data.get("gog") == "unifideck-readonly"
    except (OSError, ValueError, TypeError):
        return False


def status():
    """Safe status only. Does not decrypt credentials, contact GOG or start apps."""
    linked = _linked()
    try:
        _read_source()
        state = "linked" if linked else "available"
    except FileNotFoundError:
        state = "missing" if not linked else "source_missing"
    except (OSError, PermissionError, ValueError):
        state = "unusable"
    return {"store": "gog", "source": "unifideck", "state": state,
            "linked": linked, "can_import": state == "available"}


def _aesgcm():
    """Prefer the Decky Python cryptography package; optionally reuse Unifideck's.

    Import only the cryptography dependency, never Unifideck's auth modules.
    The temporary import path is removed immediately and is confined to the
    standard sibling plugin directory if Decky provides its plugin root.
    """
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        return AESGCM
    except ImportError:
        pass
    root = os.environ.get("DECKY_PLUGIN_DIR", "")
    if not root:
        raise RuntimeError("crypto_unavailable")
    sibling = Path(root).resolve().parent / "Unifideck" / "py_modules"
    if not sibling.is_dir() or sibling.is_symlink():
        raise RuntimeError("crypto_unavailable")
    sys.path.insert(0, str(sibling))
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        return AESGCM
    except ImportError as exc:
        raise RuntimeError("crypto_unavailable") from exc
    finally:
        sys.path.remove(str(sibling))


def _credentials():
    """Decrypt into private memory after explicit linking; never persist plaintext."""
    blob = _read_source()
    machine_id = Path("/etc/machine-id").read_text(encoding="ascii").strip()
    if not re.fullmatch(r"[a-fA-F0-9]{32}", machine_id):
        raise ValueError("Invalid device identity")
    key = hashlib.scrypt(machine_id.lower().encode("ascii"), salt=_SALT,
                         n=2**14, r=8, p=1, dklen=32)
    aesgcm = _aesgcm()
    try:
        decoded = aesgcm(key).decrypt(blob[4:16], blob[16:], None)
        tokens = json.loads(decoded.decode("utf-8"))
    except Exception as exc:
        # Includes cryptography.exceptions.InvalidTag. Never expose data or
        # exception text to Decky, logs or the frontend.
        raise ValueError("Cannot decrypt GOG session") from exc
    if not isinstance(tokens, dict) or not all(
        isinstance(tokens.get(k), str) and tokens[k] for k in ("access_token", "refresh_token")
    ):
        raise ValueError("Missing GOG credentials")
    return tokens


def _save_link(enabled):
    """Store only an explicit provider choice, never secret session material."""
    _LINK.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    state = {"gog": "unifideck-readonly"} if enabled else {}
    fd, filename = tempfile.mkstemp(prefix=".store_links-", dir=_LINK.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False)
        os.chmod(filename, 0o600)
        os.replace(filename, _LINK)
    finally:
        if os.path.exists(filename):
            os.unlink(filename)


def link():
    """Explicit user action: validates the encrypted source before consenting."""
    try:
        _credentials()
    except FileNotFoundError:
        return {"ok": False, "code": "missing"}
    except RuntimeError:
        return {"ok": False, "code": "crypto_unavailable"}
    except (OSError, ValueError, PermissionError):
        return {"ok": False, "code": "unusable"}
    _save_link(True)
    return {"ok": True, **status()}


def unlink():
    """Only unlink Hub's own consent; never log out or modify Unifideck."""
    _save_link(False)
    return {"ok": True, **status()}


def _ssl():
    # Never disable certificate verification to make GOG login appear to work.
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def _request_page(access_token, page):
    request = urllib.request.Request(
        _GOG_LIBRARY + str(page),
        headers={"Authorization": "Bearer " + access_token,
                 "Accept": "application/json", "User-Agent": "GameModeHub/0.5.65"},
    )
    with urllib.request.urlopen(request, timeout=6, context=_ssl()) as response:
        return json.load(response)


def library():
    """Fetch a bounded GOG catalogue with Unifideck's *current* access token.

    No refresh is attempted: rotating a refresh token behind Unifideck's
    back would invalidate its existing login. Users refresh in Unifideck.
    """
    if not _linked():
        return {"ok": False, "code": "not_linked", "games": []}
    try:
        credentials = _credentials()
    except FileNotFoundError:
        return {"ok": False, "code": "missing", "games": []}
    except RuntimeError:
        return {"ok": False, "code": "crypto_unavailable", "games": []}
    except (OSError, ValueError, PermissionError):
        return {"ok": False, "code": "unusable", "games": []}
    access = credentials["access_token"]
    games = []
    try:
        for page in range(1, _MAX_PAGES + 1):
            data = _request_page(access, page)
            if not isinstance(data, dict) or not isinstance(data.get("products"), list):
                return {"ok": False, "code": "bad_response", "games": []}
            for item in data["products"]:
                if not isinstance(item, dict):
                    continue
                game_id, title = item.get("id"), item.get("title")
                if not isinstance(game_id, (str, int)) or not isinstance(title, str):
                    continue
                if len(str(game_id)) > 40 or not title.strip():
                    continue
                games.append({"store": "gog", "id": str(game_id),
                              "title": title.strip()[:160]})
                if len(games) == _MAX_GAMES:
                    return {"ok": True, "games": games, "partial": True}
            total = data.get("totalPages", 1)
            if not isinstance(total, int) or total < 1 or page >= total:
                return {"ok": True, "games": games, "partial": False}
    except urllib.error.HTTPError as exc:
        return {"ok": False, "code": "auth_expired" if exc.code in (401, 403) else "network",
                "games": []}
    except (OSError, urllib.error.URLError, TimeoutError, ssl.SSLError, ValueError):
        return {"ok": False, "code": "network", "games": []}
    return {"ok": True, "games": games, "partial": True}

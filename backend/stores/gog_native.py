"""Independent GOG OAuth session for GameMode Hub (not Unifideck/Heroic).

Authentication takes place exclusively on auth.gog.com. The manual callback
is a transitional SteamOS UI flow; never ask for GOG passwords or 2FA.
Secrets are kept only in RAM unless the user explicitly opts into the user's
unlocked Secret Service vault (KWallet/compatible provider). No file fallback.
"""
from contextlib import closing
import json
import os
import re
import secrets
import threading
import time
from urllib.parse import parse_qs, urlencode, urlsplit
import urllib.error
import urllib.request
import ssl

_CLIENT_ID = "46899977096215655"  # widely-used GOG Galaxy public client credentials
_CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"
_REDIRECT = "https://embed.gog.com/on_login_success?origin=client"
_AUTH = "https://auth.gog.com/auth"
_TOKEN = "https://auth.gog.com/token"
_LIBRARY = "https://embed.gog.com/account/getFilteredProducts?mediaType=1&page="
_KEYRING_ATTRS = {"application": "GameMode Hub", "account": "GOG", "version": "1"}
_PENDING = None
_SESSION = None
_LOCK = threading.RLock()
_MAX_GAMES = 250
_MAX_PAGES = 5


def _ssl():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def _vault_collection():
    """Never auto-unlock a password vault or create a plaintext fallback."""
    if os.geteuid() == 0:
        raise RuntimeError("vault_unavailable")
    try:
        import secretstorage
        bus = secretstorage.dbus_init()
        if not secretstorage.check_service_availability(bus):
            bus.close()
            raise RuntimeError("vault_unavailable")
        collection = secretstorage.get_default_collection(bus)
        if collection.is_locked():
            bus.close()
            raise RuntimeError("vault_locked")
        return bus, collection
    except ImportError as exc:
        raise RuntimeError("vault_unavailable") from exc
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError("vault_unavailable") from exc


def _vault_save(payload):
    bus, collection = _vault_collection()
    with closing(bus):
        collection.create_item("GameMode Hub — GOG", _KEYRING_ATTRS,
                               json.dumps(payload).encode("utf-8"),
                               replace=True, content_type="application/json")


def _vault_load():
    bus, collection = _vault_collection()
    with closing(bus):
        for item in collection.search_items(_KEYRING_ATTRS):
            if item.is_locked():
                raise RuntimeError("vault_locked")
            content = json.loads(item.get_secret().decode("utf-8"))
            if isinstance(content, dict) and _valid_tokens(content):
                return content
        return None


def _vault_delete():
    bus, collection = _vault_collection()
    with closing(bus):
        for item in collection.search_items(_KEYRING_ATTRS):
            if item.is_locked():
                raise RuntimeError("vault_locked")
            item.delete()


def _valid_tokens(value):
    return isinstance(value, dict) and all(
        isinstance(value.get(k), str) and bool(value[k])
        for k in ("access_token", "refresh_token")
    )


def _request_json(url, max_bytes=131072):
    req = urllib.request.Request(url, headers={
        "Accept": "application/json", "User-Agent": "GameModeHub/0.5.66",
    })
    with urllib.request.urlopen(req, timeout=8, context=_ssl()) as response:
        blob = response.read(max_bytes + 1)
        if len(blob) > max_bytes:
            raise ValueError("Oversized response")
        return json.loads(blob.decode("utf-8"))


def _exchange(grant_type, value):
    # GOG Galaxy's publicly documented, non-standard GET token endpoint.
    fields = {"client_id": _CLIENT_ID, "client_secret": _CLIENT_SECRET,
              "grant_type": grant_type, "redirect_uri": _REDIRECT}
    fields["code" if grant_type == "authorization_code" else "refresh_token"] = value
    return _request_json(_TOKEN + "?" + urlencode(fields))


def _normalize_tokens(payload, old=None):
    if not isinstance(payload, dict):
        raise ValueError("Malformed token result")
    access = payload.get("access_token")
    refresh = payload.get("refresh_token") or (old or {}).get("refresh_token")
    if not isinstance(access, str) or not isinstance(refresh, str) or not access or not refresh:
        raise ValueError("Missing token result")
    expiry = payload.get("expires_in", 3600)
    if not isinstance(expiry, (int, float)) or not 0 < expiry <= 86400:
        expiry = 3600
    return {"access_token": access, "refresh_token": refresh,
            "expires_at": time.time() + expiry - 90,
            "saved": bool((old or {}).get("saved", False))}


def status():
    with _LOCK:
        if _valid_tokens(_SESSION):
            return {"connected": True,
                    "storage": "keyring" if _SESSION.get("saved") else "memory"}
    try:
        saved = _vault_load()
    except (OSError, ValueError, RuntimeError, Exception):
        saved = None
    if saved:
        with _LOCK:
            global _SESSION
            _SESSION = {**saved, "saved": True}
        return {"connected": True, "storage": "keyring"}
    return {"connected": False, "storage": None}


def begin(storage="memory"):
    """Creates a single authorization attempt; nothing is installed/launched."""
    global _PENDING
    if storage not in ("memory", "keyring"):
        return {"ok": False, "code": "bad_storage"}
    if storage == "keyring":
        try:
            bus, _ = _vault_collection()
            bus.close()
        except RuntimeError as exc:
            return {"ok": False, "code": str(exc)}
    with _LOCK:
        state = secrets.token_urlsafe(32)
        _PENDING = {"state": state, "started": time.monotonic(), "storage": storage}
    url = _AUTH + "?" + urlencode({
        "client_id": _CLIENT_ID, "redirect_uri": _REDIRECT,
        "response_type": "code", "layout": "client2", "state": state,
    })
    return {"ok": True, "url": url}


def _parse_callback(value, expected_state):
    if not isinstance(value, str) or not (20 <= len(value) <= 6000):
        raise ValueError("invalid callback")
    parsed = urlsplit(value.strip())
    if (parsed.scheme != "https" or parsed.username or parsed.password or parsed.port
        or parsed.hostname not in ("embed.gog.com", "www.gog.com")
        or parsed.path != "/on_login_success" or parsed.fragment):
        raise ValueError("invalid callback")
    data = parse_qs(parsed.query, keep_blank_values=True)
    if data.get("origin", ["client"]) != ["client"]:
        raise ValueError("invalid origin")
    if "state" in data and data["state"] != [expected_state]:
        raise ValueError("invalid state")
    codes = data.get("code", [])
    if len(codes) != 1 or not re.fullmatch(r"[A-Za-z0-9_-]{16,4096}", codes[0]):
        raise ValueError("invalid code")
    return codes[0]


def complete(callback):
    """One-shot callback exchange: never return/store authorization code in UI."""
    global _PENDING, _SESSION
    with _LOCK:
        attempt, _PENDING = _PENDING, None
    if not attempt or time.monotonic() - attempt["started"] > 600:
        return {"ok": False, "code": "login_expired"}
    try:
        code = _parse_callback(callback, attempt["state"])
    except ValueError:
        return {"ok": False, "code": "bad_callback"}
    try:
        payload = _exchange("authorization_code", code)
        session = _normalize_tokens(payload)
        session["saved"] = attempt["storage"] == "keyring"
        if session["saved"]:
            _vault_save(session)
    except RuntimeError as exc:
        return {"ok": False, "code": str(exc) if str(exc) in
                ("vault_locked", "vault_unavailable") else "login_failed"}
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError,
            OSError, ValueError, TypeError):
        return {"ok": False, "code": "login_failed"}
    with _LOCK:
        _SESSION = session
    return {"ok": True, "storage": attempt["storage"]}


def logout():
    """Clear Hub's own session only. Never touch Unifideck or GOG website."""
    global _SESSION, _PENDING
    with _LOCK:
        had_saved = bool(_SESSION and _SESSION.get("saved"))
    if had_saved:
        try:
            _vault_delete()
        except (RuntimeError, OSError):
            return {"ok": False, "code": "vault_locked"}
    with _LOCK:
        _SESSION = None
        _PENDING = None
    return {"ok": True}


def _current_session():
    global _SESSION
    with _LOCK:
        session = dict(_SESSION) if _valid_tokens(_SESSION) else None
    if session is None:
        try:
            saved = _vault_load()
        except (RuntimeError, ValueError, OSError):
            saved = None
        if saved:
            session = {**saved, "saved": True}
            with _LOCK:
                _SESSION = session
    return session


def _refresh(session):
    global _SESSION
    payload = _exchange("refresh_token", session["refresh_token"])
    update = _normalize_tokens(payload, session)
    if update["saved"]:
        _vault_save(update)
    with _LOCK:
        _SESSION = update
    return update


def library():
    """Only owned GOG titles, bounded and fetched when explicitly requested."""
    session = _current_session()
    if not session:
        return {"ok": False, "code": "not_logged_in", "games": []}
    try:
        if time.time() >= session.get("expires_at", 0):
            session = _refresh(session)
        return _fetch_library(session)
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            try:
                return _fetch_library(_refresh(session))
            except (OSError, RuntimeError, ValueError, urllib.error.HTTPError):
                return {"ok": False, "code": "auth_expired", "games": []}
        return {"ok": False, "code": "network", "games": []}
    except (OSError, RuntimeError, ValueError, urllib.error.URLError, TimeoutError):
        return {"ok": False, "code": "network", "games": []}


def _fetch_library(session):
    games = []
    for page in range(1, _MAX_PAGES + 1):
        req = urllib.request.Request(_LIBRARY + str(page), headers={
            "Authorization": "Bearer " + session["access_token"],
            "Accept": "application/json", "User-Agent": "GameModeHub/0.5.66",
        })
        with urllib.request.urlopen(req, timeout=7, context=_ssl()) as response:
            blob = response.read(1048577)
            if len(blob) > 1048576:
                raise ValueError("oversized library")
            data = json.loads(blob.decode("utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("products"), list):
            return {"ok": False, "code": "bad_response", "games": []}
        for product in data["products"]:
            if not isinstance(product, dict):
                continue
            identifier, title = product.get("id"), product.get("title")
            if isinstance(identifier, (str, int)) and isinstance(title, str) and title.strip():
                games.append({"store": "gog", "id": str(identifier)[:40],
                              "title": title.strip()[:160]})
            if len(games) >= _MAX_GAMES:
                return {"ok": True, "games": games, "partial": True}
        total_pages = data.get("totalPages", 1)
        if not isinstance(total_pages, int) or total_pages < 1 or page >= total_pages:
            return {"ok": True, "games": games, "partial": False}
    return {"ok": True, "games": games, "partial": True}

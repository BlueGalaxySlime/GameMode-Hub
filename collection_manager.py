"""Platform-independent GameMode Hub collections, separate from library tabs and Steam."""
import json
import re
import threading
from pathlib import Path

FILE = Path.home() / ".config" / "gamemodehub" / "collections.json"
ENABLED_FILE = Path.home() / ".config" / "gamemodehub" / "collections_enabled.json"
LOCK = threading.RLock()
MAX_COLLECTIONS = 64
MAX_APP_IDS = 1024
FILTERS = frozenset(("manual", "all", "installed", "favorites", "non_steam"))


def _app_id(value):
    if not isinstance(value, str) or not value.isascii() or not value.isdecimal():
        raise ValueError("Nieprawidłowe AppID gry.")
    number = int(value)
    if not (1 <= number <= 4294967295):
        raise ValueError("AppID poza zakresem.")
    return str(number)


def validate_collections(value):
    if not isinstance(value, list) or len(value) > MAX_COLLECTIONS:
        raise ValueError("Nieprawidłowa lista kolekcji.")
    ids = set()
    clean = []
    for entry in value:
        if not isinstance(entry, dict):
            raise ValueError("Nieprawidłowa kolekcja.")
        key = entry.get("id")
        title = entry.get("title")
        mode = entry.get("filter", "manual")
        apps = entry.get("app_ids", [])
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", key):
            raise ValueError("Nieprawidłowy identyfikator kolekcji.")
        if key in ids:
            raise ValueError("Powtórzony identyfikator kolekcji.")
        ids.add(key)
        if not isinstance(title, str) or not (1 <= len(title.strip()) <= 80):
            raise ValueError("Nieprawidłowa nazwa kolekcji.")
        if not isinstance(mode, str) or mode not in FILTERS:
            raise ValueError("Nieznana reguła kolekcji.")
        if not isinstance(apps, list) or len(apps) > MAX_APP_IDS:
            raise ValueError("Zbyt wiele gier.")
        app_ids = []
        for app in apps:
            app = _app_id(app)
            if app not in app_ids:
                app_ids.append(app)
        clean.append({"id": key, "title": title.strip(), "filter": mode, "app_ids": app_ids})
    return clean


def read_collections():
    with LOCK:
        try:
            data = json.loads(FILE.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return []
        if not isinstance(data, dict) or data.get("version") != 1:
            raise ValueError("Nieobsługiwany format kolekcji.")
        return validate_collections(data.get("collections"))


def save_collections(collections):
    clean = validate_collections(collections)
    with LOCK:
        FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = FILE.with_suffix(".tmp")
        temporary.write_text(json.dumps({"version": 1, "collections": clean},
                                        ensure_ascii=False), encoding="utf-8")
        temporary.replace(FILE)
    return clean


def read_enabled():
    """Enabled by default to preserve existing collection visibility on upgrade."""
    with LOCK:
        try:
            data = json.loads(ENABLED_FILE.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return True
        if not isinstance(data, dict) or data.get("version") != 1 or type(data.get("enabled")) is not bool:
            raise ValueError("Nieprawidłowe ustawienia kolekcji.")
        return data["enabled"]


def write_enabled(enabled):
    if type(enabled) is not bool:
        raise ValueError("Nieprawidłowe ustawienie kolekcji.")
    with LOCK:
        ENABLED_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = ENABLED_FILE.with_suffix(".tmp")
        temporary.write_text(json.dumps({"version": 1, "enabled": enabled}), encoding="utf-8")
        temporary.replace(ENABLED_FILE)
    return enabled

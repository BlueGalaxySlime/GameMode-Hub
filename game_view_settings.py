"""Explicit opt-in unified game screen settings, separate from Hub preferences."""
import json
import threading
from pathlib import Path

FILE = Path.home() / ".config" / "gamemodehub" / "game_view.json"
LOCK = threading.RLock()
SOURCES = frozenset(("steam", "gog", "epic", "heroic", "lutris", "bottles",
                     "amazon", "ubisoft", "battlenet", "itch", "xcloud", "external"))
DEFAULT = {"enabled": False, "show_protondb": True}
MAX_MAPPINGS = 512


def _data():
    try:
        value = json.loads(FILE.read_text(encoding="utf-8"))
        if not isinstance(value, dict) or value.get("version") != 1:
            return {}
        return value
    except (OSError, ValueError, TypeError):
        return {}


def _write(data):
    FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(FILE)


def get_options():
    with LOCK:
        raw = _data().get("options", {})
        if not isinstance(raw, dict):
            raw = {}
        return {key: raw[key] if type(raw.get(key)) is bool else default
                for key, default in DEFAULT.items()}


def set_options(value):
    if not isinstance(value, dict) or set(value) != set(DEFAULT) or any(
        type(value[key]) is not bool for key in DEFAULT
    ):
        raise ValueError("Nieprawidłowe opcje widoku gry.")
    with LOCK:
        state = _data()
        state.update(version=1, options=dict(value))
        _write(state)
    return get_options()


def _app_id(value):
    if type(value) not in (int, str):
        raise ValueError("Nieprawidłowe AppID.")
    digits = str(value)
    if not digits.isascii() or not digits.isdecimal() or not 1 <= int(digits) <= 4294967295:
        raise ValueError("Nieprawidłowe AppID.")
    return str(int(digits))


def get_mapping(shortcut_id):
    key = _app_id(shortcut_id)
    if int(key) < 0x80000000:
        return {"client": "steam", "steam_id": key}
    with LOCK:
        items = _data().get("games", {})
        entry = items.get(key, {}) if isinstance(items, dict) else {}
        client = entry.get("client", None)
        steam_id = entry.get("steam_id")
        if client not in SOURCES:
            client = None
        try:
            steam_id = _app_id(steam_id) if steam_id is not None else None
            if steam_id and int(steam_id) >= 0x80000000:
                steam_id = None
        except ValueError:
            steam_id = None
        return {"client": client, "steam_id": steam_id}


def set_mapping(shortcut_id, client, steam_id=None):
    key = _app_id(shortcut_id)
    if int(key) < 0x80000000:
        raise ValueError("Źródła natywnych gier Steam nie można nadpisać.")
    if client not in SOURCES:
        raise ValueError("Nieznany klient.")
    if steam_id not in (None, ""):
        steam_id = _app_id(steam_id)
        if int(steam_id) >= 0x80000000:
            raise ValueError("To nie jest Steam AppID gry.")
    else:
        steam_id = None
    with LOCK:
        state = _data()
        games = state.get("games", {})
        if not isinstance(games, dict):
            games = {}
        if key not in games and len(games) >= MAX_MAPPINGS:
            raise ValueError("Zbyt wiele przypisań.")
        games[key] = {"client": client, "steam_id": steam_id}
        state.update(version=1, games=games)
        _write(state)
    return get_mapping(key)

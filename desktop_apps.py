"""Discover Linux desktop applications for the Hub without launching shell commands.

Game Mode uses Steam's client-side shortcut API for launching.  This service
only reads .desktop metadata and persists explicit per-app preferences.
"""
import configparser
import json
import os
from pathlib import Path
import re
import shlex

STATE_FILE = Path.home() / ".config" / "gamemodehub" / "desktop_apps.json"
MAX_APPS = 512
MAX_ID = 255
FIELD_CODE = re.compile(r"%[a-zA-Z%]")


def application_directories():
    home = Path(os.environ.get("DECKY_USER_HOME") or Path.home()).resolve()
    bases = [
        home / ".local/share", home / ".local/share/flatpak/exports/share",
        Path("/var/lib/flatpak/exports/share"), Path("/usr/local/share"), Path("/usr/share"),
    ]
    return [base / "applications" for base in bases]


def _desktop_command(entry, name, path):
    raw = entry.get("Exec", fallback="")
    try:
        tokens = shlex.split(raw)
    except ValueError:
        return None
    if not tokens or any(ord(c) < 32 for c in tokens[0]):
        return None
    command = []
    for token in tokens:
        if token in ("%f", "%F", "%u", "%U", "%i", "%d", "%D", "%n", "%N", "%v", "%m"):
            continue
        token = token.replace("%c", name).replace("%k", str(path))
        token = FIELD_CODE.sub(lambda match: "%" if match.group() == "%%" else "", token)
        if token:
            command.append(token)
    if not command:
        return None
    return command[0], shlex.join(command[1:])


def list_desktop_apps():
    results = {}
    for directory in application_directories():
        if not directory.is_dir():
            continue
        # User entries are first so they override system-wide .desktop files.
        paths = sorted(directory.glob("*.desktop"))
        paths += sorted(directory.glob("*/*.desktop"))
        for path in paths:
            if len(results) >= MAX_APPS:
                break
            if path.is_symlink() or not path.is_file():
                continue
            app_id = "-".join(path.relative_to(directory).with_suffix("").parts)
            if not (0 < len(app_id) <= MAX_ID) or app_id in results:
                continue
            try:
                parser = configparser.ConfigParser(interpolation=None, strict=False)
                parser.read(path, encoding="utf-8")
                if not parser.has_section("Desktop Entry"):
                    continue
                entry = parser["Desktop Entry"]
                if entry.get("Type", "") != "Application":
                    continue
                if any(entry.getboolean(key, fallback=False) for key in ("Hidden", "NoDisplay", "Terminal")):
                    continue
                name = entry.get("Name[pl]", fallback=entry.get("Name", fallback="")).strip()
                if not name:
                    continue
                launch = _desktop_command(entry, name, path)
                if launch is None:
                    continue
                executable, arguments = launch
                working = entry.get("Path", fallback="").strip()
                results[app_id] = {
                    "id": app_id, "name": name,
                    "bin": executable, "cmd": arguments,
                    "workdir": working or str(Path(os.environ.get("DECKY_USER_HOME") or Path.home())),
                    "flatpak": entry.get("X-Flatpak", fallback="") != "" or
                               "flatpak" in path.parts,
                }
            except (OSError, UnicodeError, configparser.Error, ValueError):
                continue
    return sorted(results.values(), key=lambda app: (app["name"].casefold(), app["id"]))


def _empty_state():
    return {"apps": {}, "temporary": []}


def _app_id(value):
    if not isinstance(value, str) or not (1 <= len(value) <= MAX_ID) or any(ord(c) < 32 for c in value):
        raise ValueError("Nieprawidłowy identyfikator aplikacji.")
    return value


def _shortcut_id(value):
    if isinstance(value, bool) or not isinstance(value, int) or not (0 < value < 2**32):
        raise ValueError("Nieprawidłowy identyfikator skrótu Steam.")
    return value


def get_desktop_state():
    try:
        value = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            return _empty_state()
        apps = value.get("apps", {})
        pending = value.get("temporary", [])
        if not isinstance(apps, dict) or not isinstance(pending, list):
            return _empty_state()
        valid_apps = {}
        for key, stored in list(apps.items())[:MAX_APPS]:
            try:
                _app_id(key)
                if not isinstance(stored, dict):
                    continue
                valid_apps[key] = {
                    "favorite": stored.get("favorite") is True,
                    "hidden": stored.get("hidden") is True,
                    "shortcut": _shortcut_id(stored["shortcut"]) if stored.get("shortcut") is not None else None,
                    "lastOpened": stored.get("lastOpened") if type(stored.get("lastOpened")) is int and
                        0 <= stored["lastOpened"] < 10**16 else None,
                }
            except (ValueError, KeyError):
                continue
        valid_pending = []
        for item in pending[:256]:
            try:
                shortcut = _shortcut_id(item)
                if shortcut not in valid_pending:
                    valid_pending.append(shortcut)
            except ValueError:
                continue
        return {"apps": valid_apps, "temporary": valid_pending}
    except (OSError, ValueError, TypeError):
        return _empty_state()


def _save(value):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    temporary.replace(STATE_FILE)


def set_desktop_setting(app_id, key, value):
    app_id = _app_id(app_id)
    if key not in ("favorite", "hidden", "shortcut", "lastOpened"):
        raise ValueError("Nieznane ustawienie aplikacji.")
    if key in ("favorite", "hidden") and type(value) is not bool:
        raise ValueError("Oczekiwano włączone/wyłączone.")
    if key == "shortcut" and value is not None:
        _shortcut_id(value)
    if key == "lastOpened" and (type(value) is not int or not (0 <= value < 10**16)):
        raise ValueError("Nieprawidłowy czas uruchomienia.")
    state = get_desktop_state()
    if app_id not in state["apps"] and len(state["apps"]) >= MAX_APPS:
        raise ValueError("Zbyt wiele zapisanych aplikacji.")
    state["apps"].setdefault(app_id, {})[key] = value
    _save(state)
    return state["apps"][app_id]


def remember_temporary_shortcut(shortcut):
    shortcut = _shortcut_id(shortcut)
    state = get_desktop_state()
    if shortcut not in state["temporary"]:
        if len(state["temporary"]) >= 256:
            raise ValueError("Zbyt wiele tymczasowych skrótów.")
        state["temporary"].append(shortcut)
        _save(state)
    return state["temporary"]


def forget_temporary_shortcut(shortcut):
    shortcut = _shortcut_id(shortcut)
    state = get_desktop_state()
    if shortcut in state["temporary"]:
        state["temporary"].remove(shortcut)
        _save(state)
    return state["temporary"]

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
import uuid

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



def _safe_flatpak_export_link(path):
    """Accept Flatpak's exported .desktop links, not arbitrary user symlinks.

    Flatpak normally exports links to each installation's app tree. The old
    scanner discarded every symlink, hiding installed apps such as Firefox
    while leaving SteamOS's separate "Install Firefox" placeholder visible.
    Resolve only links from the two known export directories and require the
    target to remain inside that installation's app export tree.
    """
    home = Path(os.environ.get("DECKY_USER_HOME") or Path.home()).resolve()
    roots = (
        (home / ".local/share/flatpak/exports/share/applications",
         home / ".local/share/flatpak/app"),
        (Path("/var/lib/flatpak/exports/share/applications"),
         Path("/var/lib/flatpak/app")),
    )
    for export_dir, app_dir in roots:
        if path.parent != export_dir:
            continue
        try:
            target = path.resolve(strict=True)
            # Resolving "active" Flatpak symlinks may land on a versioned
            # checkout. It must still be a regular exported desktop file.
            return (target.is_file() and target.name == path.name and
                    target.is_relative_to(app_dir.resolve(strict=True)) and
                    target.parent.name == "applications" and
                    target.parent.parent.name == "share" and
                    target.parent.parent.parent.name == "export")
        except (OSError, RuntimeError):
            return False
    return False

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
            if (path.is_symlink() and not _safe_flatpak_export_link(path)) or not path.is_file():
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
                               "flatpak" in path.parts or
                               Path(executable).name == "flatpak" or
                               any(token.startswith("flatpak-") for token in path.parts),
                }
            except (OSError, UnicodeError, configparser.Error, ValueError):
                continue
    return sorted(results.values(), key=lambda app: (app["name"].casefold(), app["id"]))


def _empty_state():
    return {"apps": {}, "temporary": [], "views": []}


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
        views = value.get("views", [])
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
                    "category": stored.get("category") if stored.get("category") in
                        ("auto", "flatpak", "system") else "auto",
                    "shortcut": _shortcut_id(stored["shortcut"]) if stored.get("shortcut") is not None else None,
                    "window_profile": "system",  # old 0.5.52 compact scale is disabled
                    "display_profile": stored.get("display_profile") if stored.get("display_profile") in
                        ("default", "native") else "default",
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
        valid_views = []
        if isinstance(views, list):
            for view in views[:32]:
                if not isinstance(view, dict):
                    continue
                view_id, name = view.get("id"), view.get("name")
                members = view.get("appIds", [])
                if (not isinstance(view_id, str) or
                        not re.fullmatch(r"[0-9a-f]{32}", view_id) or
                        not isinstance(name, str) or
                        not (1 <= len(name.strip()) <= 50) or
                        not isinstance(members, list) or
                        any(saved["id"] == view_id or saved["name"].casefold() == name.strip().casefold()
                            for saved in valid_views)):
                    continue
                safe_members = []
                for member in members[:MAX_APPS]:
                    try:
                        _app_id(member)
                        if member not in safe_members:
                            safe_members.append(member)
                    except ValueError:
                        continue
                valid_views.append({"id": view_id, "name": name.strip(), "appIds": safe_members})
        return {"apps": valid_apps, "temporary": valid_pending, "views": valid_views}
    except (OSError, ValueError, TypeError):
        return _empty_state()


def _save(value):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    temporary.replace(STATE_FILE)


def set_desktop_setting(app_id, key, value):
    app_id = _app_id(app_id)
    if key not in ("favorite", "hidden", "shortcut", "lastOpened", "category", "window_profile", "display_profile"):
        raise ValueError("Nieznane ustawienie aplikacji.")
    if key == "window_profile":
        # Keep old clients compatible, but don't persist a harmful scale factor.
        value = "system"
    if key == "display_profile" and value not in ("default", "native"):
        raise ValueError("Nieprawidłowy profil wyświetlania.")
    if key == "category" and value not in ("auto", "flatpak", "system"):
        raise ValueError("Nieznane przypisanie kategorii.")
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


def reset_desktop_categories():
    """Reset manual grouping in one write without touching other app state."""
    state = get_desktop_state()
    count = 0
    for prefs in state["apps"].values():
        if prefs.get("category") in ("flatpak", "system"):
            prefs["category"] = "auto"
            count += 1
    if count:
        _save(state)
    return {"reset": count, "state": state}


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


def manage_desktop_view(action, view_id=None, name=None, app_id=None):
    """Manage only user-created views. Fixed views are not stored or mutable."""
    state = get_desktop_state()
    views = state["views"]
    if action == "create":
        if len(views) >= 32:
            raise ValueError("Osiągnięto limit własnych widoków.")
        if not isinstance(name, str) or not (1 <= len(name.strip()) <= 50):
            raise ValueError("Podaj nazwę widoku (maksymalnie 50 znaków).")
        name = name.strip()
        if any(view["name"].casefold() == name.casefold() for view in views):
            raise ValueError("Widok o tej nazwie już istnieje.")
        view_id = uuid.uuid4().hex
        views.append({"id": view_id, "name": name, "appIds": []})
    else:
        view = next((item for item in views if item["id"] == view_id), None)
        if view is None:
            raise ValueError("Nie znaleziono własnego widoku.")
        if action == "rename":
            if not isinstance(name, str) or not (1 <= len(name.strip()) <= 50):
                raise ValueError("Podaj nazwę widoku (maksymalnie 50 znaków).")
            name = name.strip()
            if any(item["id"] != view_id and item["name"].casefold() == name.casefold()
                   for item in views):
                raise ValueError("Widok o tej nazwie już istnieje.")
            view["name"] = name
        elif action == "delete":
            views.remove(view)
        elif action == "toggle_app":
            app_id = _app_id(app_id)
            if app_id in view["appIds"]:
                view["appIds"].remove(app_id)
            elif len(view["appIds"]) < MAX_APPS:
                view["appIds"].append(app_id)
            else:
                raise ValueError("Osiągnięto limit aplikacji w widoku.")
        else:
            raise ValueError("Nieznana operacja na widoku.")
    _save(state)
    return {"views": views, "view_id": view_id}

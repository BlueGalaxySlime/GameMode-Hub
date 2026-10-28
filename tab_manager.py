"""Persistent Tab Manager preferences, isolated from SteamHub updater."""
import json
from pathlib import Path

SETTINGS_FILE = Path.home() / ".config" / "steamhub" / "modules.json"


def _read_tab_manager_enabled():
    try:
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return isinstance(data, dict) and data.get("tab_manager_enabled") is True
    except (FileNotFoundError, OSError, ValueError, TypeError):
        return False


def _write_tab_manager_enabled(enabled):
    if type(enabled) is not bool:
        raise ValueError("Expected boolean")
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    try:
        existing = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(existing, dict):
            data = existing
    except (FileNotFoundError, OSError, ValueError, TypeError):
        pass
    data["tab_manager_enabled"] = enabled
    temporary = SETTINGS_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    temporary.replace(SETTINGS_FILE)
    return enabled


def _tabmaster_installed():
    """Best-effort informational check; never changes another plugin's state."""
    candidates = (
        Path.home() / "homebrew" / "plugins" / "TabMaster",
        Path("/home/deck/homebrew/plugins/TabMaster"),
    )
    return any(path.is_dir() for path in candidates)


# Tab definitions are kept separate from module activation and from Steam collections.
TABS_FILE = SETTINGS_FILE.with_name("tabs.json")
MAX_TABS = 64
FILTER_TYPES = frozenset(("all", "installed", "favorites", "non_steam", "collection"))


def _validate_tabs(tabs):
    if not isinstance(tabs, list) or len(tabs) > MAX_TABS:
        raise ValueError("Invalid tab list")
    ids = set()
    clean = []
    for tab in tabs:
        if not isinstance(tab, dict):
            raise ValueError("Invalid tab")
        tab_id, title = tab.get("id"), tab.get("title")
        if not isinstance(tab_id, str) or not (1 <= len(tab_id) <= 80):
            raise ValueError("Invalid tab id")
        if not isinstance(title, str) or not (1 <= len(title.strip()) <= 80):
            raise ValueError("Invalid tab title")
        if tab_id in ids:
            raise ValueError("Duplicate tab id")
        ids.add(tab_id)
        if type(tab.get("hidden", False)) is not bool:
            raise ValueError("Invalid visibility")
        kind = tab.get("filter", "all")
        if kind not in FILTER_TYPES:
            raise ValueError("Invalid tab filter")
        collection_id = tab.get("collection_id", "")
        if not isinstance(collection_id, str) or len(collection_id) > 160:
            raise ValueError("Invalid collection id")
        if kind == "collection" and not collection_id:
            raise ValueError("Missing collection id")
        clean.append({
            "id": tab_id, "title": title.strip(),
            "hidden": tab.get("hidden", False),
            "filter": kind,
            "collection_id": collection_id if kind == "collection" else "",
        })
    return clean


def read_tabs():
    try:
        tabs = json.loads(TABS_FILE.read_text(encoding="utf-8"))
        return _validate_tabs(tabs)
    except FileNotFoundError:
        return []


def save_tabs(tabs):
    clean = _validate_tabs(tabs)
    TABS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = TABS_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(clean, ensure_ascii=False), encoding="utf-8")
    temporary.replace(TABS_FILE)
    return clean

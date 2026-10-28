"""Persistent Tab Manager preferences, isolated from SteamHub updater."""
import json
from pathlib import Path

SETTINGS_FILE = Path.home() / ".config" / "steamhub" / "modules.json"


def _read_tab_manager_enabled():
    try:
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return data.get("tab_manager_enabled") is True
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


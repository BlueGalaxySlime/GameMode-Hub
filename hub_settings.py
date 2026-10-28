"""GameMode Hub selections persisted independently of the Decky plugin installation.

Do not modify, enable, disable, or otherwise manage the selected plugins.
"""
import json
from pathlib import Path

SELECTION_FILE = Path.home() / ".config" / "gamemodehub" / "selected_addons.json"
MAX_SELECTED = 64


def validate_selection(names):
    if not isinstance(names, list) or len(names) > MAX_SELECTED:
        raise ValueError("Invalid list of addons")
    result = []
    for name in names:
        if not isinstance(name, str) or not (1 <= len(name) <= 100):
            raise ValueError("Invalid addon name")
        if name in ("SteamHub", "GameModeHub", "GameMode Hub"):
            continue
        if name not in result:
            result.append(name)
    return result


def get_selected_addons():
    try:
        data = json.loads(SELECTION_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    return validate_selection(data)


def set_selected_addons(names):
    selected = validate_selection(names)
    SELECTION_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp = SELECTION_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(selected, ensure_ascii=False), encoding="utf-8")
    temp.replace(SELECTION_FILE)
    return selected

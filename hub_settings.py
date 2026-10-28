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

# Settings live outside the Decky installation directory and survive updates.
UPDATE_CHANNEL_FILE = SELECTION_FILE.parent / "update_channel.json"


def get_update_channel():
    try:
        content = json.loads(UPDATE_CHANNEL_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return "test"
    return content.get("channel") if isinstance(content, dict) and content.get("channel") in ("test", "stable") else "test"


def set_update_channel(channel):
    if not isinstance(channel, str) or channel not in ("test", "stable"):
        raise ValueError("Nieznany kanal aktualizacji.")
    UPDATE_CHANNEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = UPDATE_CHANNEL_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps({"channel": channel}), encoding="utf-8")
    tmp.replace(UPDATE_CHANNEL_FILE)
    return channel

# Generic settings used by independent frontend modules. Do not persist open
# file lists or clipboard on disk: only explicit user preferences.
HUB_PREFERENCES_FILE = SELECTION_FILE.parent / "hub_preferences.json"
DEFAULT_HUB_PREFERENCES = {"saveSession": True, "splitFileTree": False}


def validate_hub_preferences(value):
    if not isinstance(value, dict) or set(value) != set(DEFAULT_HUB_PREFERENCES):
        raise ValueError("Nieprawidlowe opcje Huba.")
    if any(not isinstance(value[key], bool) for key in DEFAULT_HUB_PREFERENCES):
        raise ValueError("Opcje Huba musza miec wartosc wlacz/wylacz.")
    return {key: value[key] for key in DEFAULT_HUB_PREFERENCES}


def get_hub_preferences():
    try:
        data = json.loads(HUB_PREFERENCES_FILE.read_text(encoding="utf-8"))
        return validate_hub_preferences(data)
    except (OSError, ValueError, TypeError):
        return dict(DEFAULT_HUB_PREFERENCES)


def set_hub_preferences(value):
    options = validate_hub_preferences(value)
    HUB_PREFERENCES_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp = HUB_PREFERENCES_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(options), encoding="utf-8")
    temp.replace(HUB_PREFERENCES_FILE)
    return options

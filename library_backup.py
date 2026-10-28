"""Versioned, local backups of library cards, collections and card profiles.

No game files, credentials, Steam collections or system settings are included.
Backups survive Decky updates and can be copied with the Hub file manager.
"""
import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import tab_manager
import collection_manager

BACKUP_DIR = Path.home() / ".config" / "gamemodehub" / "backups" / "library"
LOCK = threading.RLock()
MAX_BACKUPS = 20
MAX_BACKUP_SIZE = 2 * 1024 * 1024
NAME = re.compile(r"\d{8}T\d{6}Z-[a-f0-9]{8}\.json")


def _path(backup_id):
    if not isinstance(backup_id, str) or not NAME.fullmatch(backup_id):
        raise ValueError("Nieprawidłowy identyfikator kopii.")
    return BACKUP_DIR / backup_id


def _validate(data):
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("Nieznany format kopii.")
    tabs = tab_manager._validate_tabs(data.get("tabs"))
    collections = collection_manager.validate_collections(data.get("collections"))
    profiles = data.get("profiles")
    if not isinstance(profiles, dict) or len(profiles) > tab_manager.MAX_PROFILES:
        raise ValueError("Nieprawidłowe profile.")
    profiles = {
        tab_manager._profile_name(key): tab_manager._validate_tabs(value)
        for key, value in profiles.items()
    }
    if len(profiles) != len(data["profiles"]):
        raise ValueError("Powtarzające się profile.")
    return tabs, collections, profiles


def _summary(backup_id, data):
    tabs, collections, profiles = _validate(data)
    return {
        "id": backup_id,
        "created_at": data.get("created_at", ""),
        "kind": data.get("kind", "manual"),
        "tabs": len(tabs),
        "collections": len(collections),
        "profiles": len(profiles),
    }


def _read(backup_id):
    path = _path(backup_id)
    if path.stat().st_size > MAX_BACKUP_SIZE:
        raise ValueError("Kopia przekracza limit rozmiaru.")
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def list_backups():
    with LOCK:
        if not BACKUP_DIR.is_dir():
            return []
        result = []
        for path in sorted(BACKUP_DIR.glob("*.json"), reverse=True):
            if not NAME.fullmatch(path.name):
                continue
            try:
                result.append(_summary(path.name, _read(path.name)))
            except (OSError, ValueError, TypeError, KeyError):
                # A damaged snapshot is never offered for restoration.
                continue
        return result


def create_backup(kind="manual"):
    if kind not in ("manual", "before_restore"):
        raise ValueError("Nieprawidłowy typ kopii.")
    with LOCK:
        snapshot = {
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            "tabs": tab_manager.read_tabs(),
            "collections": collection_manager.read_collections(),
            "profiles": tab_manager._read_profiles(),
        }
        _validate(snapshot)
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8] + ".json"
        path = _path(backup_id)
        with path.open("x", encoding="utf-8") as file:
            json.dump(snapshot, file, ensure_ascii=False, indent=2)
        files = sorted((p for p in BACKUP_DIR.glob("*.json") if NAME.fullmatch(p.name)), reverse=True)
        for older in files[MAX_BACKUPS:]:
            older.unlink()
        return _summary(backup_id, snapshot)


def restore_backup(backup_id):
    with LOCK:
        data = _read(backup_id)
        tabs, collections, profiles = _validate(data)
        # Never overwrite existing settings without first saving a safety copy.
        safety = create_backup("before_restore")
        tab_manager.save_tabs(tabs)
        collection_manager.save_collections(collections)
        tab_manager._write_profiles(profiles)
        return {"ok": True, "safety_backup": safety["id"],
                "tabs": len(tabs), "collections": len(collections),
                "profiles": len(profiles)}

"""Separate cache-backed update checker. No periodic backend/network polling.

An opened view requests a check. A fresh saved result prevents rechecking.
Sources can be added later with independent TTLs and provider functions.
"""
import json
import threading
import time
from pathlib import Path

from backend.apps.flatpak_manager import flatpak_overview

CHECK_STATE_FILE = Path.home() / ".config" / "gamemodehub" / "update_checks.json"
CHECK_INTERVALS = {"flatpak": 24 * 60 * 60}
ERROR_RETRY_SECONDS = 30 * 60
MAX_APPS = 500


class UpdateChecks:
    def __init__(self, providers=None, state_file=None, clock=None):
        self._providers = providers if providers is not None else {"flatpak": flatpak_overview}
        self._state_file = state_file if state_file is not None else CHECK_STATE_FILE
        self._clock = clock if clock is not None else time.time
        self._lock = threading.RLock()
        self._saved = {}
        self._running = set()
        self._generation = {}
        self._restore()

    def _restore(self):
        try:
            raw = json.loads(self._state_file.read_text(encoding="utf-8"))
            if not isinstance(raw, dict) or raw.get("version") != 1:
                return
            for source, data in raw.get("checks", {}).items():
                if source not in self._providers or not isinstance(data, dict):
                    continue
                when = data.get("checked_at")
                apps = data.get("apps")
                error = data.get("error")
                if not isinstance(when, (int, float)) or isinstance(when, bool):
                    continue
                if not isinstance(apps, list) or len(apps) > MAX_APPS or not isinstance(error, str):
                    continue
                self._saved[source] = {"checked_at": max(0, when),
                                       "apps": [x for x in apps if isinstance(x, dict)],
                                       "error": error[:160]}
        except (OSError, TypeError, ValueError, AttributeError):
            pass

    def _write_locked(self):
        try:
            self._state_file.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._state_file.with_suffix(".tmp")
            tmp.write_text(json.dumps({"version": 1, "checks": self._saved},
                                      ensure_ascii=False), encoding="utf-8")
            tmp.replace(self._state_file)
        except OSError:
            pass

    def _status_locked(self, source):
        value = self._saved.get(source, {})
        when = value.get("checked_at", 0)
        error = value.get("error", "")
        ttl = ERROR_RETRY_SECONDS if error else CHECK_INTERVALS[source]
        next_check = when + ttl if when else None
        apps = list(value.get("apps", []))
        return {"state": ("checking" if source in self._running else
                          "error" if error else "ready" if when else "never"),
                "checked_at": when or None, "next_check_at": next_check,
                "stale": not when or self._clock() >= next_check,
                "apps": apps,
                "count": sum(bool(x.get("updateable")) for x in apps),
                "error": error}

    def status(self, source="flatpak"):
        if source not in self._providers:
            raise ValueError("Nieznany moduł sprawdzania.")
        with self._lock:
            return self._status_locked(source)

    def request(self, source="flatpak", force=False):
        if source not in self._providers or not isinstance(force, bool):
            raise ValueError("Nieprawidłowe sprawdzenie.")
        with self._lock:
            snapshot = self._status_locked(source)
            if source in self._running or (not force and not snapshot["stale"]):
                return snapshot
            generation = self._generation.get(source, 0)
            self._running.add(source)
            worker = threading.Thread(target=self._run, args=(source, generation),
                                      name="GameModeHub-Check-" + source, daemon=True)
            try:
                worker.start()
            except RuntimeError:
                self._running.remove(source)
                raise
            return self._status_locked(source)

    def _run(self, source, generation):
        try:
            result = self._providers[source]()
            apps = result["apps"]
            error = result.get("error", "")
            if not isinstance(apps, list) or not isinstance(error, str):
                raise ValueError("Invalid update check response")
            data = {"apps": [x for x in apps[:MAX_APPS] if isinstance(x, dict)],
                    "error": error[:160]}
        except Exception:
            data = {"apps": [], "error": "Nie udało się sprawdzić aktualizacji."}
        with self._lock:
            # Completion of a download can invalidate a check in flight.
            if generation == self._generation.get(source, 0):
                self._saved[source] = {"checked_at": self._clock(), **data}
                self._write_locked()
            self._running.discard(source)

    def invalidate(self, source="flatpak"):
        if source not in self._providers:
            raise ValueError("Nieznany moduł sprawdzania.")
        with self._lock:
            self._generation[source] = self._generation.get(source, 0) + 1
            if source in self._saved:
                self._saved[source]["checked_at"] = 0
                self._write_locked()

    def all_statuses(self):
        with self._lock:
            return {source: self._status_locked(source) for source in self._providers}


UPDATE_CHECKS = UpdateChecks()

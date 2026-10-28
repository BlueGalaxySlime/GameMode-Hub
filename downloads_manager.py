"""Backend-owned background downloads queue, independent of Hub/Decky views.

All UI clients observe status via short RPCs. Flatpak is the first provider.
No privileged commands, no automatic retry after backend restart, no shell.
State is saved outside the plugin install tree and survives Hub upgrades.
"""
from __future__ import annotations
import json
import os
import threading
import time
from pathlib import Path

from flatpak_manager import UPDATE_TASK, APP_ID

STATE_FILE = Path.home() / ".config" / "gamemodehub" / "downloads.json"
ACTIVE_STATES = ("queued", "preparing", "running", "cancelling")
TERMINAL_STATES = ("success", "failed", "cancelled", "interrupted")
MAX_HISTORY = 30


class DownloadManager:
    def __init__(self, task=None, state_file=None):
        self._task = task if task is not None else UPDATE_TASK
        self._path = state_file if state_file is not None else STATE_FILE
        self._lock = threading.RLock()
        self._jobs = []
        self._serial = 0
        self._active_id = None
        self._worker = None
        self._closed = False
        self._restore()

    def _save_locked(self):
        # Only metadata, no tokens, command output, device paths or user IPs.
        payload = {"version": 1, "next_id": self._serial, "jobs": self._jobs[-MAX_HISTORY:]}
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self._path)
        except OSError:
            # A read-only home must not crash the Flatpak updater.
            pass

    def _restore(self):
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict) or raw.get("version") != 1:
                return
            self._serial = max(0, int(raw.get("next_id", 0)))
            for item in raw.get("jobs", [])[-MAX_HISTORY:]:
                if not isinstance(item, dict) or not isinstance(item.get("id"), int):
                    continue
                state = item.get("state")
                if state not in ACTIVE_STATES + TERMINAL_STATES:
                    continue
                target = item.get("target", "")
                scope = item.get("scope", "user")
                if (not isinstance(target, str) or len(target) > 200 or
                    scope not in ("user", "system")):
                    continue
                self._jobs.append({
                    "id": item["id"],
                    "kind": "flatpak",
                    "target": target,
                    "scope": scope,
                    "label": "Flatpak " + ("systemowy" if scope == "system" else "użytkownika")
                             + ": " + (target or "wszystkie"),
                    "state": "interrupted" if state in ACTIVE_STATES else state,
                    "message": "Przerwane przez restart backendu; uruchom ponownie ręcznie."
                               if state in ACTIVE_STATES else str(item.get("message", ""))[:180],
                    "elapsed": max(0, int(item.get("elapsed", 0))),
                })
                self._serial = max(self._serial, item["id"])
            self._save_locked()
        except (OSError, ValueError, TypeError, OverflowError):
            pass

    def list(self):
        with self._lock:
            return {"jobs": [dict(x) for x in reversed(self._jobs[-MAX_HISTORY:])],
                    "active": sum(x["state"] in ACTIVE_STATES for x in self._jobs)}

    def enqueue_flatpak(self, target=None, scope="user"):
        if scope not in ("user", "system"):
            raise ValueError("Nieprawidłowy rodzaj instalacji.")
        if os.geteuid() == 0:
            raise PermissionError("Pobieranie Flatpak nie używa roota.")
        if target is not None and (not isinstance(target, str) or
                                   not APP_ID.fullmatch(target)):
            raise ValueError("Nieprawidłowa aplikacja Flatpak.")
        with self._lock:
            if self._closed:
                raise RuntimeError("Moduł pobierania jest wyłączany.")
            # A repeated click or stale frontend must not enqueue duplicates.
            existing = next((x for x in self._jobs if
                             x["state"] in ACTIVE_STATES and x["target"] == (target or "") and
                             x.get("scope", "user") == scope), None)
            if existing is not None:
                return dict(existing)
            self._serial += 1
            job = {"id": self._serial, "kind": "flatpak", "target": target or "",
                   "scope": scope,
                   "label": "Flatpak " + ("systemowy" if scope == "system" else "użytkownika")
                            + ": " + (target or "wszystkie"),
                   "state": "queued", "message": "W kolejce", "elapsed": 0}
            self._jobs.append(job)
            self._jobs = self._jobs[-MAX_HISTORY:]
            self._save_locked()
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(target=self._run_queue,
                                                name="GameModeHub-Downloads", daemon=True)
                self._worker.start()
            return dict(job)

    def cancel(self, job_id):
        if isinstance(job_id, bool) or not isinstance(job_id, int):
            raise ValueError("Nieprawidłowy numer pobierania.")
        active = False
        with self._lock:
            job = next((x for x in self._jobs if x["id"] == job_id), None)
            if job is None:
                raise ValueError("Nieznane pobieranie.")
            if job["state"] == "queued":
                job.update(state="cancelled", message="Usunięto z kolejki.")
                self._save_locked()
            elif job["state"] in ("preparing", "running"):
                job.update(state="cancelling", message="Zatrzymywanie…")
                active = self._active_id == job_id
                self._save_locked()
        if active:
            self._task.cancel()
        return self.list()

    def shutdown(self):
        # Unloading the plugin is NOT the same as closing its Hub window.
        # If Decky actually stops the backend, terminate the owned subprocess.
        with self._lock:
            self._closed = True
            for job in self._jobs:
                if job["state"] in ACTIVE_STATES:
                    job.update(state="interrupted",
                               message="Przerwane przez ponowne uruchomienie dodatku.")
            self._save_locked()
        self._task.cancel()

    def _run_queue(self):
        while True:
            with self._lock:
                if self._closed:
                    return
                job = next((x for x in self._jobs if x["state"] == "queued"), None)
                if job is None:
                    return
                job_id = job["id"]
                job.update(state="preparing", message="Przygotowywanie…")
                self._active_id = job_id
                self._save_locked()
                target = job["target"] or None
                scope = job.get("scope", "user")
            try:
                self._task.start(target, scope=scope)
                last_state = ""
                while True:
                    status = self._task.status()
                    with self._lock:
                        if self._closed:
                            return
                        if job["state"] not in TERMINAL_STATES:
                            job["state"] = status["state"]
                            job["message"] = status["message"]
                            job["elapsed"] = status["elapsed"]
                            if status["state"] != last_state or status["state"] in TERMINAL_STATES:
                                self._save_locked()
                        last_state = status["state"]
                    if status["state"] in TERMINAL_STATES:
                        if status["state"] == "success":
                            # Mark the cached status stale; don't run network
                            # calls as a side effect of installing an update.
                            from update_checks import UPDATE_CHECKS
                            UPDATE_CHECKS.invalidate("flatpak")
                        break
                    time.sleep(1)
            except Exception:
                with self._lock:
                    if not self._closed and job["state"] not in TERMINAL_STATES:
                        job.update(state="failed", message="Nie udało się uruchomić pobierania.")
                        self._save_locked()
            finally:
                with self._lock:
                    self._active_id = None


DOWNLOADS = DownloadManager()

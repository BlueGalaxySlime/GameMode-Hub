"""Manual Flatpak checks and opt-in per-user updates, without root or shells.

All commands use fixed argument arrays; user supplied refs are validated
against locally installed --user apps. No system Flatpak mutation or sudo.
"""
from __future__ import annotations
import os
import re
import subprocess
import signal
import threading
import time

APP_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,180}$")
MAX_APPS = 500


def _run(args, timeout=25):
    return subprocess.run(
        ["flatpak", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="replace",
        timeout=timeout, check=False,
    )


def _installed():
    result = _run(["list", "--app", "--columns=application,installation,origin,branch,version"], 12)
    if result.returncode:
        raise RuntimeError("Nie można odczytać zainstalowanych Flatpaków.")
    apps = []
    seen = set()
    for raw in result.stdout.splitlines()[:MAX_APPS + 5]:
        row = [cell.strip() for cell in raw.split("\t")]
        if len(row) < 2 or not APP_ID.fullmatch(row[0]):
            continue
        app_id, installation = row[0], row[1]
        if installation not in ("user", "system", "default"):
            installation = "system"
        key = (app_id, installation)
        if key in seen:
            continue
        seen.add(key)
        apps.append({
            "id": app_id, "installation": installation,
            "origin": row[2][:120] if len(row) > 2 else "",
            "branch": row[3][:60] if len(row) > 3 else "",
            "version": row[4][:80] if len(row) > 4 else "",
            "updateable": False,
        })
    return apps


def flatpak_overview():
    if os.geteuid() == 0:
        raise PermissionError("Hub nie zarządza Flatpakami jako root.")
    try:
        apps = _installed()
    except FileNotFoundError:
        return {"apps": [], "error": "Flatpak nie jest dostępny w systemie."}
    try:
        check = _run(["remote-ls", "--app", "--updates", "--columns=application"], 30)
        if check.returncode:
            return {"apps": apps, "error": "Nie można sprawdzić aktualizacji (sieć lub repozytorium)."}
        ids = {line.strip() for line in check.stdout.splitlines()
               if APP_ID.fullmatch(line.strip())}
        for app in apps:
            app["updateable"] = app["id"] in ids
        return {"apps": apps, "error": ""}
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return {"apps": apps, "error": "Sprawdzenie aktualizacji nie powiodło się."}


def flatpak_update_user(app_id):
    if os.geteuid() == 0:
        raise PermissionError("Aktualizacja w Hubie nie używa konta root.")
    if not isinstance(app_id, str) or not APP_ID.fullmatch(app_id):
        raise ValueError("Nieprawidłowa aplikacja.")
    apps = _installed()
    if not any(app["id"] == app_id and app["installation"] == "user" for app in apps):
        raise PermissionError("Aktualizować można tu wyłącznie Flatpaki użytkownika.")
    try:
        result = _run(["--user", "update", "--app", "--noninteractive",
                       "--assumeyes", app_id], 240)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        raise RuntimeError("Aktualizacja została przerwana lub Flatpak jest niedostępny.")
    if result.returncode:
        raise RuntimeError("Aktualizacja nie powiodła się. Sprawdź ustawienia Flatpak.")
    return {"updated": True, "id": app_id}



def flatpak_update_all_user():
    """Update only user-installed Flatpak applications, never system installations."""
    if os.geteuid() == 0:
        raise PermissionError("Aktualizacja w Hubie nie używa konta root.")
    installed = _installed()
    if not any(app["installation"] == "user" for app in installed):
        return {"updated": False}
    try:
        result = _run(["--user", "update", "--app", "--noninteractive", "--assumeyes"], 240)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        raise RuntimeError("Nie udało się zaktualizować Flatpaków użytkownika.")
    if result.returncode:
        raise RuntimeError("Aktualizacja Flatpaków użytkownika nie powiodła się.")
    return {"updated": True}


class FlatpakUpdateTask:
    """Nonblocking, supervised Flatpak process. Exactly one update at a time.

    The Decky RPC only starts a worker thread and returns a task identifier.
    A timed child process can be cancelled without freezing the SteamOS UI.
    """

    ACTIVE = ("preparing", "running", "cancelling")

    def __init__(self):
        self._lock = threading.Lock()
        self._serial = 0
        self._state = "idle"
        self._target = ""
        self._message = ""
        self._start_time = 0.0
        self._end_time = 0.0
        self._cancel_requested = False
        self._process = None

    def _status_locked(self):
        end = self._end_time or time.monotonic()
        elapsed = max(0, int(end - self._start_time)) if self._start_time else 0
        return {
            "id": self._serial,
            "state": self._state,
            "target": self._target,
            "message": self._message,
            "elapsed": elapsed,
        }

    def status(self):
        with self._lock:
            return self._status_locked()

    @staticmethod
    def _signal_process(proc, sig):
        try:
            os.killpg(proc.pid, sig)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                if sig == signal.SIGKILL:
                    proc.kill()
                else:
                    proc.terminate()
            except (ProcessLookupError, OSError):
                pass

    def cancel(self):
        with self._lock:
            if self._state not in self.ACTIVE:
                return self._status_locked()
            self._cancel_requested = True
            self._state = "cancelling"
            self._message = "Zatrzymywanie aktualizacji Flatpak…"
            process = self._process
            result = self._status_locked()
        if process is not None:
            self._signal_process(process, signal.SIGTERM)
        return result

    def start(self, target=None):
        if os.geteuid() == 0:
            raise PermissionError("Aktualizacja w Hubie nie używa konta root.")
        if target is not None and (not isinstance(target, str) or
                                   not APP_ID.fullmatch(target)):
            raise ValueError("Nieprawidłowy identyfikator Flatpaka.")
        with self._lock:
            if self._state in self.ACTIVE:
                raise RuntimeError("Aktualizacja Flatpak już trwa.")
            self._serial += 1
            serial = self._serial
            self._state = "preparing"
            self._target = target or ""
            self._message = "Przygotowywanie aktualizacji…"
            self._start_time = time.monotonic()
            self._end_time = 0.0
            self._process = None
            self._cancel_requested = False
        threading.Thread(target=self._worker, args=(serial, target),
                         name="GameModeHub-Flatpak", daemon=True).start()
        return self.status()

    def _worker(self, serial, target):
        proc = None
        final = "failed"
        text = "Aktualizacja Flatpak nie powiodła się."
        try:
            apps = _installed()
            if target is not None:
                if not any(a["id"] == target and a["installation"] == "user" for a in apps):
                    raise PermissionError("To nie jest Flatpak z instalacji użytkownika.")
            elif not any(a["installation"] == "user" for a in apps):
                raise RuntimeError("Brak zainstalowanych Flatpaków użytkownika.")

            # One batch command for ALL user applications and runtimes,
            # not a slow re-launch of flatpak for every app.
            args = ["flatpak", "--user", "update", "--noninteractive", "--assumeyes"]
            if target:
                args.append(target)
            with self._lock:
                if self._cancel_requested or serial != self._serial:
                    final, text = "cancelled", "Aktualizacja anulowana."
                else:
                    proc = subprocess.Popen(
                        args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT, start_new_session=True
                    )
                    self._process = proc
                    self._state = "running"
                    self._message = ("Aktualizowanie " + target + "…" if target
                                     else "Aktualizowanie wszystkich Flatpaków użytkownika…")
            if proc is not None:
                try:
                    output, _ = proc.communicate(timeout=600)
                except subprocess.TimeoutExpired:
                    self._signal_process(proc, signal.SIGTERM)
                    try:
                        proc.communicate(timeout=5)
                    except subprocess.TimeoutExpired:
                        self._signal_process(proc, signal.SIGKILL)
                        proc.communicate()
                    raise TimeoutError("Flatpak przekroczył limit 10 minut. Spróbuj później.")
                if proc.returncode == 0:
                    final, text = "success", "Aktualizacja zakończona."
                else:
                    # Errors may contain terminal escapes; never echo command output
                    # or other possibly private system data into the public UI.
                    final, text = "failed", "Flatpak zakończył się błędem (kod " + str(proc.returncode) + ")."
        except (FileNotFoundError, OSError, subprocess.SubprocessError,
                PermissionError, RuntimeError, TimeoutError) as exc:
            final, text = "failed", str(exc)[:180]
        finally:
            with self._lock:
                if serial == self._serial:
                    self._state = "cancelled" if self._cancel_requested else final
                    self._message = "Aktualizacja anulowana." if self._cancel_requested else text
                    self._end_time = time.monotonic()
                    self._process = None


UPDATE_TASK = FlatpakUpdateTask()

"""Manual Flatpak checks and opt-in per-user updates, without root or shells.

All commands use fixed argument arrays; user supplied refs are validated
against locally installed --user apps. No system Flatpak mutation or sudo.
"""
from __future__ import annotations
import os
import re
import subprocess

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

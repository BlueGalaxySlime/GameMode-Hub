"""Opt-in ProtonDB badge summaries, cached per Steam AppID.

No telemetry, tokens, runtime process, third-party gateway or HTML scraping.
Network requests occur only when the user checks one Steam AppID.
This deliberately does not patch Steam/other launchers' UI.
"""
import json
import re
import ssl
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

DATA_FILE = Path.home() / ".config" / "gamemodehub" / "protondb_badges.json"
PROTONDB_SUMMARY = "https://www.protondb.com/api/v1/reports/summaries/{}.json"
SUCCESS_TTL = 24 * 60 * 60
ERROR_TTL = 30 * 60
MAX_RESULTS = 80
TIERS = {"platinum", "gold", "silver", "bronze", "borked", "native", "pending"}


def validate_app_id(value):
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise ValueError("Podaj numeryczne Steam AppID.")
    text = str(value)
    if not re.fullmatch(r"[1-9][0-9]{0,9}", text) or int(text) > 4294967295:
        raise ValueError("Nieprawidłowe Steam AppID.")
    return text


def _fetch_summary(app_id):
    request = urllib.request.Request(
        PROTONDB_SUMMARY.format(app_id),
        headers={"Accept": "application/json", "User-Agent": "GameMode-Hub-ProtonDB/0.5"},
        method="GET",
    )
    # Use the system CA configuration; never disable TLS verification.
    with urllib.request.urlopen(request, timeout=6, context=ssl.create_default_context()) as response:
        data = json.load(response)
    if not isinstance(data, dict):
        raise ValueError("Invalid ProtonDB response.")
    tier = str(data.get("tier", "")).lower()
    if tier not in TIERS:
        return {"tier": "unrated", "reports": 0}
    total = data.get("total", 0)
    return {"tier": tier, "reports": total if isinstance(total, int) and 0 <= total < 100000000 else 0}


class ProtonDBBadgeCache:
    def __init__(self, path=None, fetch=None, clock=None):
        self._path = path or DATA_FILE
        self._fetch = fetch or _fetch_summary
        self._clock = clock or time.time
        self._lock = threading.RLock()
        self._entries = {}
        self._restore()

    def _restore(self):
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict) or raw.get("version") != 1:
                return
            for app_id, value in raw.get("apps", {}).items():
                try:
                    validate_app_id(app_id)
                except ValueError:
                    continue
                if not isinstance(value, dict) or value.get("tier") not in TIERS | {"unrated", "error"}:
                    continue
                when = value.get("checked_at")
                if not isinstance(when, (int, float)) or isinstance(when, bool) or when < 0:
                    continue
                self._entries[app_id] = {
                    "tier": value["tier"],
                    "reports": int(value.get("reports", 0)) if isinstance(value.get("reports", 0), int) else 0,
                    "checked_at": when,
                }
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    def _save_locked(self):
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(json.dumps({"version": 1, "apps": self._entries}, ensure_ascii=False),
                           encoding="utf-8")
            tmp.replace(self._path)
        except OSError:
            pass

    def lookup(self, app_id, force=False):
        app_id = validate_app_id(app_id)
        if not isinstance(force, bool):
            raise ValueError("Nieprawidłowe żądanie odświeżania.")
        with self._lock:
            old = self._entries.get(app_id)
            if old and not force:
                period = ERROR_TTL if old["tier"] == "error" else SUCCESS_TTL
                if self._clock() < old["checked_at"] + period:
                    return self._result(app_id, old, cached=True)
        try:
            result = self._fetch(app_id)
            tier = str(result.get("tier", "")).lower()
            if tier not in TIERS | {"unrated"}:
                tier = "unrated"
            reports = result.get("reports", 0)
            entry = {"tier": tier,
                     "reports": reports if isinstance(reports, int) and reports >= 0 else 0,
                     "checked_at": self._clock()}
        except urllib.error.HTTPError as error:
            entry = {"tier": "unrated" if error.code == 404 else "error",
                     "reports": 0, "checked_at": self._clock()}
        except (urllib.error.URLError, OSError, ValueError, TypeError, KeyError, TimeoutError):
            entry = {"tier": "error", "reports": 0, "checked_at": self._clock()}
        with self._lock:
            self._entries[app_id] = entry
            # Bounded storage; no bulk harvesting of ProtonDB.
            if len(self._entries) > MAX_RESULTS:
                oldest = sorted(self._entries, key=lambda k: self._entries[k]["checked_at"])
                for key in oldest[:len(self._entries) - MAX_RESULTS]:
                    del self._entries[key]
            self._save_locked()
        return self._result(app_id, entry, cached=False)

    @staticmethod
    def _result(app_id, entry, cached):
        return {"app_id": app_id, "tier": entry["tier"], "reports": entry["reports"],
                "checked_at": entry["checked_at"], "cached": cached,
                "url": "https://www.protondb.com/app/" + app_id}


BADGES = ProtonDBBadgeCache()

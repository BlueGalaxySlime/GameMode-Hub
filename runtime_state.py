"""Three runtime states and on-demand backend diagnostics.

Sampling only happens when DEV view requests it. No idle measurement loop.
CPU percent is relative to one core, not full CPU usage of SteamOS.
"""
import os
import threading
import time

_lock = threading.Lock()
_ui_open = False
_last_cpu = None


def set_hub_ui_open(opened):
    global _ui_open
    if not isinstance(opened, bool):
        raise ValueError("Nieprawidłowy stan widoku.")
    with _lock:
        _ui_open = opened
    return {"ok": True}


def get_runtime_state(active_downloads=0):
    with _lock:
        ui_open = _ui_open
    return "active" if ui_open else "background" if active_downloads else "sleeping"


def diagnostics(active_downloads=0):
    global _last_cpu
    rss_mib = None
    try:
        with open("/proc/self/status", encoding="utf-8") as stat:
            for line in stat:
                if line.startswith("VmRSS:"):
                    rss_mib = round(int(line.split()[1]) / 1024.0, 1)
                    break
    except (OSError, ValueError, IndexError):
        pass
    now, cpu = time.monotonic(), time.process_time()
    with _lock:
        previous = _last_cpu
        _last_cpu = (now, cpu)
    cpu_percent = None
    if previous is not None and now > previous[0]:
        cpu_percent = round(max(0.0, (cpu - previous[1]) * 100 / (now - previous[0])), 1)
    return {"state": get_runtime_state(active_downloads),
            "backend_cpu_percent": cpu_percent,
            "backend_rss_mib": rss_mib,
            "active_downloads": active_downloads,
            "pid": os.getpid()}

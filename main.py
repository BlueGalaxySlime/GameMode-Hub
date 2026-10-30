"""GameMode Hub release checker. Installation is delegated to Decky Loader."""
import asyncio
import json
import re
import ssl
import sys
from pathlib import Path
import urllib.error
import urllib.request

# Decky executes main.py via importlib.spec_from_file_location in a sandbox
# and adds only DECKY_PLUGIN_DIR/py_modules to sys.path. The plugin root is
# NOT automatically importable. Register it before importing bundled modules,
# otherwise the entire Python backend exits at startup (all RPCs time out).
_PLUGIN_ROOT = str(Path(__file__).resolve().parent)
if _PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, _PLUGIN_ROOT)

from backend.core.hub_settings import (
    get_selected_addons, set_selected_addons, get_update_channel, set_update_channel,
    get_hub_preferences, set_hub_preferences,
    get_favorite_folders, set_favorite_folders, get_favorite_labels, set_favorite_label,
)
from backend.core.release_catalog import RELEASES_API as RELEASE_CATALOG_API, catalog, validate_channel
from backend.files.file_manager import listing as list_files, create_folder, rename_entry, paste_entry, paste_entries
from backend.apps.desktop_apps import (list_desktop_apps, get_desktop_state, set_desktop_setting,
                          reset_desktop_categories, remember_temporary_shortcut,
                          forget_temporary_shortcut, manage_desktop_view)
from backend.files.trash_manager import trash_entry, list_trash, restore_entry
from backend.files.lan_transfer import TransferManager
from backend.apps.flatpak_manager import flatpak_overview, flatpak_update_user, flatpak_update_all_user, heroic_installed
from backend.downloads.downloads_manager import DOWNLOADS
from backend.downloads.update_checks import UPDATE_CHECKS
from backend.library.protondb_badges import BADGES
from backend.library.game_view_settings import (
    get_options as game_view_options,
    set_options as game_view_save_options,
    get_mapping as game_view_mapping,
    set_mapping as game_view_save_mapping,
)
from backend.core.runtime_state import set_hub_ui_open, get_runtime_state, diagnostics as runtime_diagnostics
from backend.library import tab_manager
from backend.library import collection_manager
from backend.library import library_backup
from backend.stores import gog_unifideck, gog_native

CURRENT_VERSION = "0.5.69"
RELEASES_API = "https://api.github.com/repos/BlueGalaxySlime/GameMode-Hub/releases/latest"
ASSET_NAME = "GameMode-Hub.zip"


def _version(value):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?", value or "")
    return (*map(int, match.groups()[:3]), 0 if match.group(4) else 1) if match else None


def _ssl_context():
    """Use an explicit trusted CA bundle when Decky's Python lacks CA paths."""
    candidates = []
    try:
        import certifi
        candidates.append(certifi.where())
    except ImportError:
        pass
    candidates.extend((
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/ssl/cert.pem",
        "/etc/pki/tls/certs/ca-bundle.crt",
    ))
    for path in candidates:
        if path and Path(path).is_file():
            try:
                context = ssl.create_default_context(cafile=path)
                context.set_alpn_protocols(["http/1.1"])
                return context
            except (OSError, ssl.SSLError):
                continue
    raise RuntimeError(
        "Brak zaufanego zestawu certyfikatów CA w środowisku Decky. "
        "Zainstaluj certifi dla Pythona Decky lub udostępnij systemowy plik CA."
    )


def _fetch_releases(channel):
    """One bounded request per explicit click in the update panel."""
    validate_channel(channel)
    request = urllib.request.Request(
        RELEASE_CATALOG_API,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "GameModeHub/" + CURRENT_VERSION,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=7, context=_ssl_context()) as response:
        data = json.load(response)
    return catalog(data, channel, CURRENT_VERSION)


def _fetch_latest_release():
    """Backward-compatible check result, matching the selected update channel."""
    releases = _fetch_releases(get_update_channel())
    newest = next((entry for entry in releases if entry["action"] == "upgrade"), None)
    return {
        "current": CURRENT_VERSION,
        "latest": newest["version"] if newest else None,
        "url": newest["url"] if newest else None,
        "sha256": newest["sha256"] if newest else None,
        "available": newest is not None,
        "status": "ok" if releases else "no_releases",
        "error": None if releases else "Brak wydan w wybranym kanale.",
    }


class Plugin:
    def __init__(self):
        # Load PTY engine only when actually needed. An engine import error
        # must never prevent Decky from loading SteamHub's updater/settings.
        self._terminal = None
        self._transfer = TransferManager()

    async def terminal_ping(self):
        # Handshake checks connectivity without creating any PTY or shell.
        return {"ok": True, "version": CURRENT_VERSION, "protocol": 2, "terminal_enabled": True}

    def _terminal_service(self):
        # The PTY engine is loaded only after the user explicitly starts a session.
        if self._terminal is None:
            from terminal_core.service import TerminalService
            self._terminal = TerminalService()
        return self._terminal

    async def terminal_start(self, cols=80, rows=24):
        # PTY creation belongs to a worker thread, not Decky's asyncio loop.
        # TerminalService refuses root and caps active sessions at three.
        service = self._terminal_service()
        return await asyncio.to_thread(service.start, cols, rows)

    async def terminal_read(self, session_id):
        if self._terminal is None:
            raise ValueError("Terminal session not found")
        return await asyncio.to_thread(self._terminal.read, session_id)

    async def terminal_write(self, session_id, data):
        if self._terminal is None:
            raise ValueError("Terminal session not found")
        return await asyncio.to_thread(self._terminal.write, session_id, data)

    async def terminal_resize(self, session_id, cols, rows):
        if self._terminal is None:
            raise ValueError("Terminal session not found")
        return await asyncio.to_thread(self._terminal.resize, session_id, cols, rows)

    async def terminal_close(self, session_id):
        if self._terminal is None:
            return {"ok": True}
        return await asyncio.to_thread(self._terminal.close, session_id)

    async def _unload(self):
        if self._terminal is not None:
            await asyncio.to_thread(self._terminal.close_all)
            self._terminal = None
        await asyncio.to_thread(self._transfer.stop)
        DOWNLOADS.shutdown()

    async def get_selected_addons(self):
        return await asyncio.to_thread(get_selected_addons)

    async def set_selected_addons(self, names):
        return await asyncio.to_thread(set_selected_addons, names)

    async def get_hub_preferences(self):
        return await asyncio.to_thread(get_hub_preferences)

    async def set_hub_preferences(self, options):
        return await asyncio.to_thread(set_hub_preferences, options)

    async def hub_ui_open(self, opened):
        return set_hub_ui_open(opened)

    async def game_view_get_options(self):
        return await asyncio.to_thread(game_view_options)

    async def game_view_set_options(self, options):
        return await asyncio.to_thread(game_view_save_options, options)

    async def game_view_get_mapping(self, app_id):
        return await asyncio.to_thread(game_view_mapping, app_id)

    async def game_view_set_mapping(self, app_id, client, steam_id=None):
        return await asyncio.to_thread(game_view_save_mapping, app_id, client, steam_id)

    async def protondb_get_badge(self, app_id, force=False):
        return await asyncio.to_thread(BADGES.lookup, app_id, force)

    # UI > Gaming Mode > Karty: activation and layout are independent of collections.
    async def get_tab_manager_enabled(self):
        return await asyncio.to_thread(tab_manager._read_tab_manager_enabled)

    async def set_tab_manager_enabled(self, enabled):
        return await asyncio.to_thread(tab_manager._write_tab_manager_enabled, enabled)

    async def get_hidden_steam_tabs(self):
        return await asyncio.to_thread(tab_manager.read_hidden_steam_tabs)

    async def save_hidden_steam_tabs(self, ids):
        return await asyncio.to_thread(tab_manager.save_hidden_steam_tabs, ids)

    async def get_tab_definitions(self):
        return await asyncio.to_thread(tab_manager.read_tabs)

    async def save_tab_definitions(self, tabs):
        return await asyncio.to_thread(tab_manager.save_tabs, tabs)

    async def list_tab_profiles(self):
        return await asyncio.to_thread(tab_manager.list_tab_profiles)

    async def save_tab_profile(self, name):
        return await asyncio.to_thread(tab_manager.save_tab_profile, name)

    async def load_tab_profile(self, name):
        return await asyncio.to_thread(tab_manager.load_tab_profile, name)

    async def delete_tab_profile(self, name):
        return await asyncio.to_thread(tab_manager.delete_tab_profile, name)

    # UI > Gaming Mode > Kolekcje: no mutation of Steam's collection database.
    async def get_hub_collections(self):
        return await asyncio.to_thread(collection_manager.read_collections)

    async def save_hub_collections(self, collections):
        return await asyncio.to_thread(collection_manager.save_collections, collections)

    async def get_hub_collections_enabled(self):
        return await asyncio.to_thread(collection_manager.read_enabled)

    async def set_hub_collections_enabled(self, enabled):
        return await asyncio.to_thread(collection_manager.write_enabled, enabled)

    async def get_hub_library_backups(self):
        return await asyncio.to_thread(library_backup.list_backups)

    async def create_hub_library_backup(self):
        return await asyncio.to_thread(library_backup.create_backup)

    async def restore_hub_library_backup(self, backup_id):
        return await asyncio.to_thread(library_backup.restore_backup, backup_id)

    async def hub_runtime_state(self):
        active = DOWNLOADS.list()["active"]
        return {"state": get_runtime_state(active), "downloads": active}

    async def hub_dev_diagnostics(self):
        if not get_hub_preferences().get("developerMode", False):
            return {"enabled": False}
        active = DOWNLOADS.list()["active"]
        return {"enabled": True, **runtime_diagnostics(active),
                "checks": UPDATE_CHECKS.all_statuses()}

    async def checks_flatpak(self, force=False):
        return UPDATE_CHECKS.request("flatpak", force)

    async def checks_flatpak_status(self):
        return UPDATE_CHECKS.status("flatpak")

    async def get_update_channel(self):
        return await asyncio.to_thread(get_update_channel)

    async def set_update_channel(self, channel):
        validate_channel(channel)
        return await asyncio.to_thread(set_update_channel, channel)

    async def list_releases(self, channel):
        validate_channel(channel)
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_releases, channel), timeout=10
        )

    async def transfer_status(self):
        return await asyncio.to_thread(self._transfer.status)

    async def transfer_start(self):
        return await asyncio.to_thread(self._transfer.start)

    async def transfer_stop(self):
        return await asyncio.to_thread(self._transfer.stop)

    async def transfer_share(self, path):
        return await asyncio.to_thread(self._transfer.share, path)

    async def files_list(self, path=None, hidden=False, offset=0, sort_by="name", descending=False):
        return await asyncio.to_thread(list_files, path, hidden, offset, sort_by, descending)

    async def files_trash(self, path):
        return await asyncio.to_thread(trash_entry, path)

    async def files_trash_list(self):
        return await asyncio.to_thread(list_trash)

    async def files_trash_restore(self, item_id):
        return await asyncio.to_thread(restore_entry, item_id)

    async def files_mkdir(self, folder, name):
        return await asyncio.to_thread(create_folder, folder, name)

    async def files_rename(self, source, name):
        return await asyncio.to_thread(rename_entry, source, name)

    async def files_paste(self, source, destination, mode):
        return await asyncio.to_thread(paste_entry, source, destination, mode)

    async def files_paste_many(self, sources, destination, mode):
        return await asyncio.to_thread(paste_entries, sources, destination, mode)

    async def flatpak_overview(self):
        return await asyncio.to_thread(flatpak_overview)

    async def downloads_list(self):
        return DOWNLOADS.list()

    async def downloads_enqueue_flatpak(self, app_id=None, scope="user"):
        return DOWNLOADS.enqueue_flatpak(app_id, scope)

    # Stores are separate adapters; the GOG link never handles a password.
    async def gog_link_status(self):
        return await asyncio.to_thread(gog_unifideck.status)

    async def gog_link_import(self):
        return await asyncio.to_thread(gog_unifideck.link)

    async def gog_link_remove(self):
        return await asyncio.to_thread(gog_unifideck.unlink)

    async def gog_native_status(self):
        return await asyncio.to_thread(gog_native.status)

    async def gog_native_begin(self, storage="memory"):
        return await asyncio.to_thread(gog_native.begin, storage)

    async def gog_native_complete(self, callback):
        return await asyncio.wait_for(
            asyncio.to_thread(gog_native.complete, callback), timeout=20
        )

    async def gog_native_logout(self):
        return await asyncio.to_thread(gog_native.logout)

    async def gog_library(self):
        return await asyncio.wait_for(
            asyncio.to_thread(gog_native.library), timeout=55
        )

    async def heroic_get_status(self):
        return await asyncio.to_thread(heroic_installed)

    async def downloads_install_heroic(self):
        return DOWNLOADS.enqueue_heroic()

    async def downloads_cancel(self, job_id):
        return DOWNLOADS.cancel(job_id)

    # Backwards compatibility for previous 0.5.33 frontend during hot reload.
    async def flatpak_task_start(self, app_id=None):
        return DOWNLOADS.enqueue_flatpak(app_id)

    async def flatpak_task_status(self):
        return DOWNLOADS._task.status()

    async def flatpak_task_cancel(self):
        return DOWNLOADS._task.cancel()

    async def flatpak_update_user(self, app_id):
        return await asyncio.to_thread(flatpak_update_user, app_id)

    async def flatpak_update_all_user(self):
        return await asyncio.to_thread(flatpak_update_all_user)

    async def desktop_list_apps(self):
        return await asyncio.to_thread(list_desktop_apps)

    async def desktop_get_state(self):
        return await asyncio.to_thread(get_desktop_state)

    async def desktop_manage_view(self, action, view_id=None, name=None, app_id=None):
        return await asyncio.to_thread(manage_desktop_view, action, view_id, name, app_id)

    async def desktop_set_setting(self, app_id, key, value):
        return await asyncio.to_thread(set_desktop_setting, app_id, key, value)

    async def desktop_reset_categories(self):
        return await asyncio.to_thread(reset_desktop_categories)

    async def desktop_remember_temporary(self, shortcut_id):
        return await asyncio.to_thread(remember_temporary_shortcut, shortcut_id)

    async def desktop_forget_temporary(self, shortcut_id):
        return await asyncio.to_thread(forget_temporary_shortcut, shortcut_id)

    async def get_favorite_folders(self):
        return await asyncio.to_thread(get_favorite_folders)

    async def set_favorite_folders(self, paths):
        return await asyncio.to_thread(set_favorite_folders, paths)

    async def get_favorite_labels(self):
        return await asyncio.to_thread(get_favorite_labels)

    async def set_favorite_label(self, path, label):
        return await asyncio.to_thread(set_favorite_label, path, label)

    async def _main(self):
        pass

    async def check_updates(self):
        try:
            return await asyncio.wait_for(asyncio.to_thread(_fetch_latest_release), timeout=10)
        except asyncio.TimeoutError:
            status, detail = "error", "Przekroczono limit czasu sprawdzania GitHub. Spróbuj ponownie."
        except urllib.error.HTTPError as error:
            if error.code == 404:
                status, detail = "no_releases", "GitHub nie znalazł opublikowanego wydania (HTTP 404)."
            elif error.code in (403, 429):
                status, detail = "error", f"GitHub ograniczył liczbę żądań (HTTP {error.code}). Spróbuj później."
            else:
                status, detail = "error", f"GitHub zwrócił błąd HTTP {error.code}."
        except (urllib.error.URLError, OSError, TimeoutError) as error:
            status, detail = "error", f"Błąd połączenia z GitHub: {getattr(error, 'reason', str(error))}"
        except RuntimeError as error:
            status, detail = "error", str(error)
        except (ValueError, TypeError, KeyError) as error:
            status, detail = "error", f"Nieprawidłowa odpowiedź GitHub: {type(error).__name__}."
        return {
            "current": CURRENT_VERSION, "latest": None, "url": None,
            "sha256": None, "available": False, "status": status, "error": detail,
        }

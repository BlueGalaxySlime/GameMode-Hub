"""Reversible file removal for GameMode Hub (freedesktop home Trash).

Only ordinary user files on the home filesystem may be moved. This module
deliberately has NO permanent-delete endpoint, subprocess or recursive removal.
External/mounted drives are refused until a same-device trash implementation is
available, so shutil.move can never silently copy-and-delete a large directory.
"""
import configparser
import ctypes
from datetime import datetime
import errno
import os
from pathlib import Path
import re
import stat
from urllib.parse import quote, unquote
from uuid import uuid4

from backend.files.file_manager import _allowed_roots, _guard_write

MAX_TRASH_ITEMS = 100
_TRASH_ID = re.compile(r"^gmh-[a-f0-9]{32}-.{1,200}$", re.DOTALL)
# Protect the user shell, Decky/Steam databases, hidden config and top-level
# XDG folders. Their contents remain accessible for ordinary file operations.
_PROTECTED_HOME_DIRS = {
    "Desktop", "Downloads", "Documents", "Pictures", "Music", "Videos",
    "Public", "Templates", "Games", "Gry", "Applications", "Emulation",
}


def _home():
    return _allowed_roots()[0][1]


def _ensure_within_home(path, *, exists=True):
    home = _home()
    if not isinstance(path, str) or not path.startswith("/") or "\x00" in path:
        raise ValueError("Nieprawidłowa ścieżka.")
    literal = Path(path)
    # Refuse path tricks and all symbolic-link components, not only the last.
    if ".." in literal.parts:
        raise PermissionError("Nie można usuwać ścieżek z '..'.")
    try:
        rel = literal.relative_to(home)
    except ValueError:
        raise PermissionError("Kosz obsługuje tylko pliki na dysku domowym.")
    if not rel.parts:
        raise PermissionError("Nie można usunąć katalogu domowego.")
    if any(part.startswith(".") for part in rel.parts):
        raise PermissionError("Ukryte katalogi i pliki systemowe są chronione.")
    if len(rel.parts) == 1 and rel.parts[0] in _PROTECTED_HOME_DIRS:
        raise PermissionError("To chroniony katalog główny użytkownika.")
    node = home
    for part in rel.parts:
        node = node / part
        if node.is_symlink():
            raise PermissionError("Nie można przenosić dowiązań symbolicznych.")
    resolved = literal.resolve(strict=exists)
    if home not in resolved.parents:
        raise PermissionError("Ścieżka poza katalogiem domowym.")
    if exists and not (resolved.is_file() or resolved.is_dir()):
        raise ValueError("Nieobsługiwany rodzaj pliku.")
    return resolved


def _trash_roots(create=False):
    home = _home()
    trash = home / ".local" / "share" / "Trash"
    files, info = trash / "files", trash / "info"
    # Reject a modified Trash path (e.g. an attacker-replaced symlink).
    for item in (home / ".local", home / ".local/share", trash, files, info):
        if item.is_symlink():
            raise PermissionError("Niebezpieczne dowiązanie w ścieżce Kosza.")
        if create:
            item.mkdir(mode=0o700, exist_ok=True)
        if item.exists():
            mode = item.stat()
            if not stat.S_ISDIR(mode.st_mode) or mode.st_uid != os.geteuid():
                raise PermissionError("Kosz nie należy do bieżącego użytkownika.")
    return files, info


def _rename_exclusive(source, target):
    """Linux renameat2(RENAME_NOREPLACE): never overwrite files or folders."""
    libc = ctypes.CDLL(None, use_errno=True)
    try:
        rename = libc.renameat2
    except AttributeError as error:
        raise RuntimeError("Bezpieczne przenoszenie jest niedostępne w tym systemie.") from error
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int,
                       ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    result = rename(-100, os.fsencode(source), -100, os.fsencode(target), 1)
    if result != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error), str(target))


def trash_entry(path):
    _guard_write()
    source = _ensure_within_home(path)
    files, info = _trash_roots(create=True)
    if source.stat().st_dev != files.stat().st_dev:
        raise PermissionError("Nośniki na innym dysku wymagają osobnego Kosza.")
    name = source.name
    if len(name) > 200 or any(ord(ch) < 32 or ord(ch) == 127 for ch in name):
        raise ValueError("Nieobsługiwana nazwa pliku.")
    item_id = "gmh-" + uuid4().hex + "-" + name
    destination, metadata = files / item_id, info / (item_id + ".trashinfo")
    text = ("[Trash Info]\nPath=" + quote(str(source), safe="/") +
            "\nDeletionDate=" + datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S") + "\n")
    # Metadata is created before the move: power loss cannot orphan a moved file.
    with metadata.open("x", encoding="utf-8") as stream:
        stream.write(text)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        _rename_exclusive(source, destination)
    except BaseException:
        metadata.unlink(missing_ok=True)
        raise
    return {"id": item_id, "name": name, "path": str(source)}


def _metadata(item_id):
    if not isinstance(item_id, str) or not _TRASH_ID.fullmatch(item_id):
        raise ValueError("Nieprawidłowy wpis Kosza.")
    files, info = _trash_roots()
    saved = files / item_id
    description = info / (item_id + ".trashinfo")
    if saved.is_symlink() or description.is_symlink() or not saved.exists() or not description.is_file():
        raise FileNotFoundError("Nie znaleziono wpisu w Koszu.")
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(description, encoding="utf-8")
    original = unquote(parser.get("Trash Info", "Path"))
    date = parser.get("Trash Info", "DeletionDate", fallback="")
    if Path(original).name != item_id.split("-", 2)[-1]:
        raise ValueError("Metadane Kosza nie pasują do pliku.")
    _ensure_within_home(original, exists=False)
    return saved, description, original, date


def list_trash():
    files, info = _trash_roots()
    if not files.is_dir() or not info.is_dir():
        return []
    entries = []
    for metadata in sorted(info.iterdir(), key=lambda path: path.name, reverse=True):
        if len(entries) >= MAX_TRASH_ITEMS:
            break
        item_id = metadata.name.removesuffix(".trashinfo")
        if not metadata.name.endswith(".trashinfo"):
            continue
        try:
            item, _, original, date = _metadata(item_id)
            entries.append({
                "id": item_id, "name": Path(original).name, "path": original,
                "directory": item.is_dir(), "date": date,
            })
        except (OSError, ValueError, PermissionError, KeyError, configparser.Error):
            continue
    return entries


def restore_entry(item_id):
    _guard_write()
    source, metadata, original, _ = _metadata(item_id)
    destination = Path(original)
    if not destination.parent.is_dir() or destination.parent.is_symlink():
        raise FileNotFoundError("Katalog docelowy nie istnieje. Przywróć najpierw folder nadrzędny.")
    if destination.exists() or destination.is_symlink():
        raise FileExistsError("Element o tej nazwie już istnieje. Niczego nie nadpisano.")
    if source.stat().st_dev != destination.parent.stat().st_dev:
        raise PermissionError("Nie można bezpiecznie przenieść między dyskami.")
    _rename_exclusive(source, destination)
    metadata.unlink()
    return {"path": str(destination)}

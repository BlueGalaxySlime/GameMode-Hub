"""Reversible file removal for GameMode Hub (freedesktop home Trash).

User files on the home filesystem can be moved to a shared freedesktop Trash.
Protected paths need an additional confirmation. Emptying Trash is a separate,
explicitly confirmed permanent operation. External drives remain unsupported
until a same-device trash implementation is available.
"""
import configparser
import ctypes
from datetime import datetime
import errno
import os
from pathlib import Path
import shutil
import stat
from urllib.parse import quote, unquote
from uuid import uuid4

from backend.files.file_manager import _allowed_roots, _guard_write

MAX_TRASH_ITEMS = 1500
# Top-level XDG folders prompt an additional confirmation when moved wholesale.
# Hidden files prompt too; paths within them remain available to expert users.
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


def _protected_reason(source):
    """Paths may be used, but sensitive locations require an explicit warning."""
    rel = source.relative_to(_home())
    if len(rel.parts) == 1 and rel.parts[0] in _PROTECTED_HOME_DIRS:
        return "To jeden z głównych katalogów użytkownika."
    if any(part.startswith(".") for part in rel.parts):
        return "Ścieżka zawiera ukryte pliki lub katalogi z danymi aplikacji."
    return ""


def inspect_trash(path):
    """Validate a candidate and tell the UI whether extra confirmation is required."""
    _guard_write()
    source = _ensure_within_home(path)
    trash_root = _home() / ".local" / "share" / "Trash"
    if source == trash_root or source in trash_root.parents or trash_root in source.parents:
        raise PermissionError("Nie można przenieść Kosza ani katalogu zawierającego Kosz do niego samego.")
    files, _ = _trash_roots(create=True)
    if source.stat().st_dev != files.stat().st_dev:
        raise PermissionError("Nośniki na innym dysku wymagają osobnego Kosza.")
    reason = _protected_reason(source)
    return {"protected": bool(reason), "reason": reason, "path": str(source)}


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


def trash_entry(path, confirm_protected=False):
    details = inspect_trash(path)
    if details["protected"] and confirm_protected is not True:
        raise PermissionError("Wymagane potwierdzenie operacji na chronionej ścieżce.")
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
    if (not isinstance(item_id, str) or not (1 <= len(item_id) <= 240)
            or item_id in (".", "..") or "/" in item_id or "\\" in item_id
            or "\\x00" in item_id):
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
    if item_id.startswith("gmh-") and Path(original).name != item_id.split("-", 2)[-1]:
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


def _check_tree_device(folder, device):
    """Never recursively remove a mounted filesystem inside a trashed directory."""
    for root, directories, filenames in os.walk(folder, followlinks=False):
        for name in ["."] + directories + filenames:
            item = Path(root) if name == "." else Path(root) / name
            if item.lstat().st_dev != device:
                raise PermissionError("Kosz zawiera punkt montowania z innego dysku.")


def empty_trash(confirm=False):
    """Permanently empty the shared freedesktop home Trash, only on explicit consent."""
    _guard_write()
    if confirm is not True:
        raise PermissionError("Opróżnienie Kosza wymaga osobnego potwierdzenia.")
    files, info = _trash_roots()
    if not files.exists() or not info.exists():
        return {"count": 0}
    device = files.stat().st_dev
    # Preflight entries before starting any irreversible deletion.
    entries = list(files.iterdir())
    for entry in entries:
        if entry.lstat().st_dev != device:
            raise PermissionError("Kosz zawiera plik z innego dysku.")
        if entry.is_dir() and not entry.is_symlink():
            _check_tree_device(entry, device)
    for entry in entries:
        if entry.is_dir() and not entry.is_symlink():
            shutil.rmtree(entry)
        else:
            entry.unlink()
        metadata = info / (entry.name + ".trashinfo")
        if metadata.is_file() or metadata.is_symlink():
            metadata.unlink()
    # Remove orphaned metadata left by interrupted trash operations, too.
    for metadata in info.iterdir():
        if metadata.is_file() or metadata.is_symlink():
            metadata.unlink()
    return {"count": len(entries)}

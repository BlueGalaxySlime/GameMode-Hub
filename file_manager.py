"""Lightweight file operations for the SteamOS Decky Quick Access UI.

No shell, no sudo, no file contents sent to the browser. All paths are
confined to the SteamOS user's home or mounted media. This module is
platform-independent so another UI can reuse the service later.
"""
import os
from pathlib import Path
import shutil

PAGE_SIZE = 40
MAX_ENTRIES = 1500
MAX_NAME = 200


def _allowed_roots():
    """Decky provides DECKY_USER_HOME, even if its service has another HOME."""
    home = Path(os.environ.get("DECKY_USER_HOME") or Path.home()).resolve()
    if not home.is_dir():
        raise RuntimeError("Katalog domowy użytkownika jest niedostępny.")
    roots = [("Dom", home)]
    user = os.environ.get("DECKY_USER") or home.name
    media = Path("/run/media") / user
    if media.is_dir():
        roots.append(("Nośniki", media.resolve()))
    # Some distros use /media/<user> instead of /run/media/<user>.
    alternate = Path("/media") / user
    if alternate.is_dir():
        roots.append(("Nośniki", alternate.resolve()))
    return roots


def _normalize(path=None):
    if path is None:
        result = _allowed_roots()[0][1]
    elif isinstance(path, str) and path.startswith("/") and "\x00" not in path:
        result = Path(path).resolve()
    else:
        raise ValueError("Nieprawidłowa ścieżka.")
    if not any(result == root or root in result.parents for _, root in _allowed_roots()):
        raise PermissionError("Poza katalogiem domowym i dołączonymi nośnikami.")
    return result


def _guard_write():
    if os.geteuid() == 0:
        raise PermissionError("Operacje zapisu są niedostępne dla wtyczki uruchomionej jako root.")


def _name(value):
    if not isinstance(value, str) or not (1 <= len(value) <= MAX_NAME):
        raise ValueError("Nieprawidłowa nazwa.")
    if value in (".", "..") or "/" in value or "\\" in value or "\x00" in value:
        raise ValueError("Nazwa nie może zawierać separatorów ścieżki.")
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise ValueError("Nazwa zawiera niedozwolone znaki.")
    return value


def _child(parent, name):
    child = parent / _name(name)
    # Resolve only for validation; real source/destination is checked again.
    if child.is_symlink():
        raise PermissionError("Operacje na dowiązaniach nie są obsługiwane.")
    return _normalize(str(child))


def _require_source(path):
    path = _normalize(path)
    if not path.exists() or path.is_symlink():
        raise FileNotFoundError("Nie znaleziono pliku lub folderu.")
    if any(path == root for _, root in _allowed_roots()):
        raise PermissionError("Nie można modyfikować katalogu głównego lokalizacji.")
    return path


def locations():
    return [{"name": label, "path": str(root)} for label, root in _allowed_roots()]


def listing(path=None, hidden=False, offset=0, sort_by="name", descending=False):
    folder = _normalize(path)
    if not folder.is_dir():
        raise NotADirectoryError("To nie jest folder.")
    if not isinstance(hidden, bool):
        raise ValueError("Nieprawidłowe ustawienie ukrytych plików.")
    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
        raise ValueError("Nieprawidłowa strona.")
    if sort_by not in ("name", "size", "date") or not isinstance(descending, bool):
        raise ValueError("Nieprawidłowe sortowanie.")
    results = []
    with os.scandir(folder) as entries:
        for entry in entries:
            if not hidden and entry.name.startswith("."):
                continue
            if len(results) >= MAX_ENTRIES:
                break
            try:
                # Symlinks are shown but cannot be traversed or modified;
                # never stat their targets.
                symlink = entry.is_symlink()
                is_dir = not symlink and entry.is_dir(follow_symlinks=False)
                stat = entry.stat(follow_symlinks=False)
                results.append({
                    "name": entry.name,
                    "path": str(folder / entry.name),
                    "directory": is_dir,
                    "symlink": symlink,
                    "size": stat.st_size if not is_dir else None,
                    "modified": stat.st_mtime,
                })
            except (PermissionError, FileNotFoundError, OSError):
                continue
    # Sort BEFORE pagination: page boundaries must remain consistent.
    # Keep folders above files in all modes.
    folders = [item for item in results if item["directory"]]
    files = [item for item in results if not item["directory"]]
    def key(item):
        if sort_by == "name":
            return item["name"].casefold()
        if sort_by == "size":
            return (item["size"] or 0, item["name"].casefold())
        return (item["modified"], item["name"].casefold())
    folders.sort(key=lambda item: item["name"].casefold(), reverse=descending)
    files.sort(key=key, reverse=descending)
    results = folders + files
    root_paths = {root for _, root in _allowed_roots()}
    parent = folder.parent if folder not in root_paths else None
    if parent is not None:
        try:
            _normalize(str(parent))
        except PermissionError:
            parent = None
    return {
        "path": str(folder),
        "parent": str(parent) if parent is not None else None,
        "roots": locations(),
        "items": results[offset:offset + PAGE_SIZE],
        "total": len(results),
        "offset": offset,
        "limit": PAGE_SIZE,
        "truncated": len(results) >= MAX_ENTRIES,
    }


def create_folder(folder, name):
    _guard_write()
    parent = _normalize(folder)
    if not parent.is_dir():
        raise NotADirectoryError("Nie znaleziono katalogu docelowego.")
    destination = _child(parent, name)
    # mkdir fails safely when the destination already exists.
    destination.mkdir(mode=0o755, exist_ok=False)
    return {"path": str(destination)}


def rename_entry(source, name):
    _guard_write()
    source_path = _require_source(source)
    target = _child(source_path.parent, name)
    if target == source_path:
        return {"path": str(source_path)}
    if target.exists() or target.is_symlink():
        raise FileExistsError("Element o tej nazwie już istnieje.")
    source_path.rename(target)
    return {"path": str(target)}


def paste_entry(source, target_folder, mode):
    _guard_write()
    if mode not in ("copy", "move"):
        raise ValueError("Nieznana operacja.")
    original = _require_source(source)
    dest_dir = _normalize(target_folder)
    if not dest_dir.is_dir():
        raise NotADirectoryError("Nie znaleziono folderu docelowego.")
    destination = _child(dest_dir, original.name)
    if original == destination or destination.exists() or destination.is_symlink():
        raise FileExistsError("Element o tej nazwie już istnieje w katalogu docelowym.")
    if original.is_dir():
        # Prevent recursive copy and accidental moving of a directory into itself.
        if original in destination.parents:
            raise ValueError("Folder docelowy znajduje się wewnątrz źródłowego.")
        if mode == "copy":
            raise ValueError("Kopiowanie całych folderów nie jest jeszcze obsługiwane.")
        # os.rename is atomic, and safely fails across separate drives.
        original.rename(destination)
    elif original.is_file():
        if mode == "move":
            # Use rename when on same filesystem; otherwise copy then unlink.
            try:
                original.rename(destination)
            except OSError as ex:
                import errno
                if ex.errno != errno.EXDEV:
                    raise
                _copy_file(original, destination)
                original.unlink()
        else:
            _copy_file(original, destination)
    else:
        raise ValueError("Nieobsługiwany rodzaj pliku.")
    return {"path": str(destination)}


def _copy_file(source, destination):
    # 'xb' prevents accidentally overwriting an existing file. Never delete
    # preexisting destinations when exclusive creation raises FileExistsError.
    created = False
    try:
        with source.open("rb") as src, destination.open("xb") as dst:
            created = True
            shutil.copyfileobj(src, dst, length=1024 * 1024)
    except Exception:
        if created:
            destination.unlink(missing_ok=True)
        raise

"""Reversible Trash tests: no destructive delete, no overwrite, no system folders."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.files import trash_manager


class TrashTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.home = self.root / "home"
        self.home.mkdir()
        allowed = patch.object(trash_manager, "_allowed_roots",
                               return_value=[("Dom", self.home)])
        allowed.start()
        self.addCleanup(allowed.stop)
        write = patch.object(trash_manager, "_guard_write", return_value=None)
        write.start()
        self.addCleanup(write.stop)

    def test_file_can_be_trashed_and_restored_with_contents(self):
        path = self.home / "notes with spaces.txt"
        path.write_text("important", encoding="utf-8")
        moved = trash_manager.trash_entry(str(path))
        self.assertFalse(path.exists())
        self.assertEqual(moved["name"], path.name)
        listed = trash_manager.list_trash()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["path"], str(path))
        self.assertFalse(listed[0]["directory"])
        restored = trash_manager.restore_entry(moved["id"])
        self.assertEqual(restored["path"], str(path))
        self.assertEqual(path.read_text(encoding="utf-8"), "important")
        self.assertEqual(trash_manager.list_trash(), [])

    def test_folder_trashes_and_restores_entire_tree_without_deleting_files(self):
        folder = self.home / "mods"
        folder.mkdir()
        inner = folder / "content"
        inner.mkdir()
        (inner / "game.ini").write_text("value=1")
        moved = trash_manager.trash_entry(str(folder))
        self.assertFalse(folder.exists())
        self.assertTrue(trash_manager.list_trash()[0]["directory"])
        trash_manager.restore_entry(moved["id"])
        self.assertEqual((folder / "content/game.ini").read_text(), "value=1")

    def test_protect_home_hidden_configuration_and_system_directories(self):
        for directory in ("Downloads", "Documents", "Desktop", ".local", ".config", ".steam", ".var"):
            with self.subTest(directory=directory):
                item = self.home / directory
                item.mkdir()
                with self.assertRaises(PermissionError):
                    trash_manager.trash_entry(str(item))
                self.assertTrue(item.exists())
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(self.home))
        file_in_config = self.home / ".config" / "settings.json"
        file_in_config.write_text("keep")
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(file_in_config))
        self.assertEqual(file_in_config.read_text(), "keep")

    def test_protect_outside_roots_and_symbolic_links(self):
        external = self.root / "outside"
        external.write_text("untouched")
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(external))
        symlink = self.home / "jump"
        symlink.symlink_to(external)
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(symlink))
        self.assertTrue(symlink.is_symlink())
        self.assertEqual(external.read_text(), "untouched")
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(self.home / "jump" / ".." / "test"))
    
    def test_restore_never_overwrites_an_existing_file(self):
        path = self.home / "notes.txt"
        path.write_text("old")
        moved = trash_manager.trash_entry(str(path))
        path.write_text("new")
        with self.assertRaises(FileExistsError):
            trash_manager.restore_entry(moved["id"])
        self.assertEqual(path.read_text(), "new")
        self.assertEqual(len(trash_manager.list_trash()), 1)

    def test_restore_must_have_original_parent(self):
        parent = self.home / "user-folder"
        parent.mkdir()
        file = parent / "example.txt"
        file.write_text("keep")
        moved = trash_manager.trash_entry(str(file))
        parent.rmdir()
        with self.assertRaises(FileNotFoundError):
            trash_manager.restore_entry(moved["id"])
        self.assertEqual(len(trash_manager.list_trash()), 1)

    def test_reject_fake_item_id(self):
        for item_id in ("../etc/passwd", "gmh-xxx", "../../trash", "foo.txt"):
            with self.subTest(item=item_id), self.assertRaises(ValueError):
                trash_manager.restore_entry(item_id)

    def test_belongs_to_home_filesystem_only(self):
        # An external mounted drive never falls back to copy+unlink.
        outside = self.root / "sdcard"
        outside.mkdir()
        path = outside / "file.txt"
        path.write_text("keep")
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(path))
        self.assertEqual(path.read_text(), "keep")


if __name__ == "__main__":
    unittest.main()

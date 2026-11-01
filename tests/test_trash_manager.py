"""Shared Trash tests: explicit confirmations, restore and safe permanent empty."""
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

    def test_protected_paths_require_confirmation_but_can_be_managed(self):
        config = self.home / ".config"
        config.mkdir()
        file_in_config = config / "settings.json"
        file_in_config.write_text("keep")
        self.assertTrue(trash_manager.inspect_trash(str(file_in_config))["protected"])
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(file_in_config))
        moved = trash_manager.trash_entry(str(file_in_config), confirm_protected=True)
        self.assertFalse(file_in_config.exists())
        trash_manager.restore_entry(moved["id"])
        self.assertEqual(file_in_config.read_text(), "keep")

        documents = self.home / "Documents"
        documents.mkdir()
        self.assertTrue(trash_manager.inspect_trash(str(documents))["protected"])
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(documents))
        moved = trash_manager.trash_entry(str(documents), confirm_protected=True)
        trash_manager.restore_entry(moved["id"])
        self.assertTrue(documents.exists())

    def test_can_reach_game_mods_inside_hidden_app_directory(self):
        game_mods = self.home / ".local/share/Steam/steamapps/common/Game/Mods"
        game_mods.mkdir(parents=True)
        (game_mods / "loader.dll").write_text("mod")
        with self.assertRaises(PermissionError):
            trash_manager.trash_entry(str(game_mods))
        moved = trash_manager.trash_entry(str(game_mods), True)
        self.assertFalse(game_mods.exists())
        trash_manager.restore_entry(moved["id"])
        self.assertTrue((game_mods / "loader.dll").exists())

    def test_cannot_trash_the_trash_or_its_parent(self):
        trash_manager.list_trash()
        for directory in (self.home / ".local",
                          self.home / ".local/share",
                          self.home / ".local/share/Trash"):
            directory.mkdir(parents=True, exist_ok=True)
            with self.assertRaises(PermissionError):
                trash_manager.trash_entry(str(directory), True)

    def test_empty_trash_requires_explicit_confirmation(self):
        first = self.home / "first.txt"
        second = self.home / "second.txt"
        first.write_text("one")
        second.write_text("two")
        trash_manager.trash_entry(str(first))
        trash_manager.trash_entry(str(second))
        with self.assertRaises(PermissionError):
            trash_manager.empty_trash()
        self.assertEqual(len(trash_manager.list_trash()), 2)
        self.assertEqual(trash_manager.empty_trash(True)["count"], 2)
        self.assertEqual(trash_manager.list_trash(), [])
        self.assertEqual(trash_manager.empty_trash(True)["count"], 0)

    def test_shared_freedesktop_trash_includes_desktop_entries(self):
        trash_manager.empty_trash(True)
        files, info = trash_manager._trash_roots(create=True)
        desktop_item = files / "deleted_by_dolphin.txt"
        desktop_item.write_text("old")
        (info / "deleted_by_dolphin.txt.trashinfo").write_text(
            "[Trash Info]\\nPath=" + str(self.home / "deleted_by_dolphin.txt")
            + "\\nDeletionDate=2026-11-01T12:00:00\\n", encoding="utf-8")
        listed = trash_manager.list_trash()
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["name"], "deleted_by_dolphin.txt")
        self.assertEqual(trash_manager.empty_trash(True)["count"], 1)
        self.assertFalse(desktop_item.exists())

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

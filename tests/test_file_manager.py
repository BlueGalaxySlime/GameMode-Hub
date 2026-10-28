"""File manager permissions, navigation and safe operations without SteamOS."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import file_manager


class FileManagerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name) / "home"
        self.home.mkdir()
        self.external = Path(self.tmp.name) / "external"
        self.external.mkdir()
        self.roots = patch.object(file_manager, "_allowed_roots", return_value=[("Dom", self.home)])
        self.roots.start()
        self.addCleanup(self.roots.stop)
        self.user = patch.object(file_manager.os, "geteuid", return_value=1000)
        self.user.start()
        self.addCleanup(self.user.stop)

    def test_default_navigation_and_paging(self):
        (self.home / "A").mkdir()
        (self.home / ".hide").write_text("hidden")
        (self.home / "test.txt").write_text("abc")
        page = file_manager.listing()
        self.assertEqual(page["path"], str(self.home))
        self.assertIsNone(page["parent"])
        self.assertEqual([item["name"] for item in page["items"]], ["A", "test.txt"])
        self.assertEqual(file_manager.listing(hidden=True)["total"], 3)
        self.assertEqual(file_manager.listing(str(self.home / "A"))["parent"], str(self.home))

    def test_create_rename_copy_and_move_file(self):
        folder = file_manager.create_folder(str(self.home), "Nowy folder")
        self.assertTrue(Path(folder["path"]).is_dir())
        source = self.home / "dane.txt"
        source.write_text("sample")
        renamed = file_manager.rename_entry(str(source), "dane2.txt")
        self.assertFalse(source.exists())
        copied = file_manager.paste_entry(renamed["path"], folder["path"], "copy")
        self.assertEqual(Path(copied["path"]).read_text(), "sample")
        self.assertTrue(Path(renamed["path"]).exists())
        another = self.home / "other"
        another.mkdir()
        moved = file_manager.paste_entry(renamed["path"], str(another), "move")
        self.assertTrue(Path(moved["path"]).exists())
        self.assertFalse(Path(renamed["path"]).exists())

    def test_conflicts_and_invalid_names_do_not_overwrite(self):
        source = self.home / "existing"
        source.write_text("keep")
        with self.assertRaises(FileExistsError):
            file_manager.create_folder(str(self.home), "existing")
        self.assertEqual(file_manager.rename_entry(str(source), "existing")["path"], str(source))
        with self.assertRaises(FileExistsError):
            file_manager.paste_entry(str(source), str(self.home), "copy")
        self.assertEqual(source.read_text(), "keep")
        for name in ("..", ".", "x/y", "x\\y", "bad\x00name", "", "a"*201):
            with self.subTest(name=name), self.assertRaises(ValueError):
                file_manager.create_folder(str(self.home), name)

    def test_cannot_escape_home_by_path_or_symlink(self):
        (self.home / "jump").symlink_to(self.external, target_is_directory=True)
        with self.assertRaises(PermissionError):
            file_manager.listing(str(self.external))
        with self.assertRaises(PermissionError):
            file_manager.listing(str(self.home / "jump"))
        with self.assertRaises(PermissionError):
            file_manager.create_folder(str(self.home), "../outside")
        with self.assertRaises(PermissionError):
            file_manager.rename_entry(str(self.home), "renamed")
        with self.assertRaises(PermissionError):
            file_manager.paste_entry(str(self.home), str(self.external), "move")
        with self.assertRaises(PermissionError):
            file_manager.rename_entry(str(self.home / "jump"), "another")

    def test_exclusive_create_never_deletes_an_existing_file(self):
        src = self.home / "src.txt"
        src.write_text("source")
        dest = self.home / "dest.txt"
        dest.write_text("important")
        with self.assertRaises(FileExistsError):
            file_manager._copy_file(src, dest)
        self.assertEqual(dest.read_text(), "important")

    def test_never_write_as_root(self):
        with patch.object(file_manager.os, "geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                file_manager.create_folder(str(self.home), "test")

    def test_folders_cannot_copy_recursively_or_move_into_themselves(self):
        folder = self.home / "parent"
        folder.mkdir()
        child = folder / "child"
        child.mkdir()
        with self.assertRaises(ValueError):
            file_manager.paste_entry(str(folder), str(child), "move")
        target = self.home / "other"
        target.mkdir()
        with self.assertRaises(ValueError):
            file_manager.paste_entry(str(folder), str(target), "copy")

    def test_pagination_bounds(self):
        for i in range(45):
            (self.home / f"item{i:03d}").write_text("")
        first = file_manager.listing(offset=0)
        second = file_manager.listing(offset=40)
        self.assertEqual(len(first["items"]), 40)
        self.assertEqual(len(second["items"]), 5)
        with self.assertRaises(ValueError):
            file_manager.listing(offset=-1)


if __name__ == "__main__":
    unittest.main()

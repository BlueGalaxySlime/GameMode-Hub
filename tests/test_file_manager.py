"""File manager permissions, navigation and safe operations without SteamOS."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from backend.files import file_manager


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
        with self.assertRaises(ValueError):
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

    def test_copy_folder_recursively_but_never_into_itself(self):
        folder = self.home / "parent"
        folder.mkdir()
        child = folder / "child"
        child.mkdir()
        (child / "mod.ini").write_text("x=1")
        with self.assertRaises(ValueError):
            file_manager.paste_entry(str(folder), str(child), "move")
        target = self.home / "other"
        target.mkdir()
        result = file_manager.paste_entry(str(folder), str(target), "copy")
        self.assertEqual((Path(result["path"]) / "child" / "mod.ini").read_text(), "x=1")
        with self.assertRaises(FileExistsError):
            file_manager.paste_entry(str(folder), str(target), "copy")
        with self.assertRaises(ValueError):
            file_manager.paste_entry(str(folder), str(child), "copy")

    def test_copy_folder_rejects_nested_symlinks(self):
        folder = self.home / "mods"
        folder.mkdir()
        (folder / "escape").symlink_to(self.external, target_is_directory=True)
        target = self.home / "target"
        target.mkdir()
        with self.assertRaises(PermissionError):
            file_manager.paste_entry(str(folder), str(target), "copy")
        self.assertFalse((target / "mods").exists())

    def test_paste_many_copies_and_preflights_name_conflicts(self):
        source = self.home / "mods"
        source.mkdir()
        a, b = source / "a.txt", source / "b.txt"
        a.write_text("a")
        b.write_text("b")
        target = self.home / "target"
        target.mkdir()
        result = file_manager.paste_entries([str(a), str(b)], str(target), "copy")
        self.assertEqual(result["count"], 2)
        self.assertEqual((target / "a.txt").read_text(), "a")
        self.assertEqual((target / "b.txt").read_text(), "b")
        with self.assertRaises(FileExistsError):
            file_manager.paste_entries([str(a), str(b)], str(target), "copy")
        with self.assertRaises(ValueError):
            file_manager.paste_entries([str(a), str(a)], str(self.home), "move")


    def test_sort_before_pagination(self):
        for name, size in (("c.txt", 10), ("a.txt", 30), ("b.txt", 20)):
            (self.home / name).write_bytes(b"x" * size)
        self.assertEqual([x["name"] for x in file_manager.listing(sort_by="name")["items"]],
                         ["a.txt", "b.txt", "c.txt"])
        self.assertEqual([x["name"] for x in file_manager.listing(sort_by="size")["items"]],
                         ["c.txt", "b.txt", "a.txt"])
        self.assertEqual([x["name"] for x in file_manager.listing(sort_by="size", descending=True)["items"]],
                         ["a.txt", "b.txt", "c.txt"])
        (self.home / "folder").mkdir()
        self.assertEqual(file_manager.listing(sort_by="size")["items"][0]["name"], "folder")

    def test_type_sorting(self):
        for name in ("photo.png", "notes.txt", "archive.zip", "another.txt"):
            (self.home / name).write_text("x")
        self.assertEqual([x["name"] for x in file_manager.listing(sort_by="type")["items"]],
                         ["photo.png", "another.txt", "notes.txt", "archive.zip"])
        self.assertEqual([x["name"] for x in file_manager.listing(sort_by="type", descending=True)["items"]],
                         ["archive.zip", "notes.txt", "another.txt", "photo.png"])

    def test_date_sorting(self):
        files = [self.home / "old.txt", self.home / "new.txt"]
        for path in files:
            path.write_text("x")
        os.utime(files[0], (1000000000, 1000000000))
        os.utime(files[1], (1100000000, 1100000000))
        self.assertEqual([x["name"] for x in file_manager.listing(sort_by="date", descending=True)["items"]],
                         ["new.txt", "old.txt"])

    def test_reject_invalid_sort(self):
        for setting in ("", "../", "bogus", None, 4):
            with self.subTest(setting=setting), self.assertRaises(ValueError):
                file_manager.listing(sort_by=setting)
        for descending in ("true", 1, None):
            with self.subTest(descending=descending), self.assertRaises(ValueError):
                file_manager.listing(descending=descending)

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

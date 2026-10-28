"""Backups of the Hub library layout survive updates and are safe to restore."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import collection_manager
import tab_manager
import library_backup
import main


class LibraryBackupTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        base = Path(temporary.name)
        patches = (
            (tab_manager, "SETTINGS_FILE", base / "steamhub" / "modules.json"),
            (tab_manager, "TABS_FILE", base / "steamhub" / "tabs.json"),
            (tab_manager, "PROFILES_FILE", base / "steamhub" / "tab_profiles.json"),
            (collection_manager, "FILE", base / "gamemodehub" / "collections.json"),
            (library_backup, "BACKUP_DIR", base / "gamemodehub" / "backups" / "library"),
        )
        for module, name, value in patches:
            p = patch.object(module, name, value)
            p.start()
            self.addCleanup(p.stop)

    def test_create_and_restore_all_data(self):
        original_tabs = tab_manager.save_tabs([
            {"id": "a", "title": "GOG", "filter": "hub_collection", "collection_id": "gog"}
        ])
        original_collections = collection_manager.save_collections([
            {"id": "gog", "title": "GOG", "filter": "manual", "app_ids": ["1234"]}
        ])
        tab_manager.save_tab_profile("Mój układ")
        backup = library_backup.create_backup()
        self.assertEqual(backup["tabs"], 1)
        self.assertEqual(backup["collections"], 1)
        self.assertEqual(backup["profiles"], 1)

        tab_manager.save_tabs([])
        collection_manager.save_collections([])
        tab_manager._write_profiles({})

        result = library_backup.restore_backup(backup["id"])
        self.assertTrue(result["ok"])
        self.assertEqual(tab_manager.read_tabs(), original_tabs)
        self.assertEqual(collection_manager.read_collections(), original_collections)
        self.assertEqual(tab_manager.list_tab_profiles(), ["Mój układ"])
        self.assertEqual(len(library_backup.list_backups()), 2)
        self.assertEqual(
            [x["kind"] for x in library_backup.list_backups()],
            ["before_restore", "manual"],
        )

    def test_safety_backup_restores_previous_state(self):
        tab_manager.save_tabs([{"id": "a", "title": "Poprzedni"}])
        older = library_backup.create_backup()
        tab_manager.save_tabs([{"id": "b", "title": "Nowy"}])
        restored = library_backup.restore_backup(older["id"])
        library_backup.restore_backup(restored["safety_backup"])
        self.assertEqual(tab_manager.read_tabs()[0]["title"], "Nowy")

    def test_reject_traversal(self):
        for name in ("../tabs.json", "/etc/passwd", "made-up.json", "a" * 1000):
            with self.assertRaises(ValueError):
                library_backup.restore_backup(name)

    def test_corrupted_backup_does_not_replace_state(self):
        tab_manager.save_tabs([{"id": "current", "title": "Bieżąca"}])
        entry = library_backup.create_backup()
        (library_backup.BACKUP_DIR / entry["id"]).write_text(
            json.dumps({"version": 1, "tabs": "bad", "collections": [], "profiles": {}}),
            encoding="utf-8"
        )
        with self.assertRaises(ValueError):
            library_backup.restore_backup(entry["id"])
        self.assertEqual(tab_manager.read_tabs()[0]["title"], "Bieżąca")

    def test_backend_exposes_backup_methods(self):
        plugin = main.Plugin()
        for name in ("get_hub_library_backups", "create_hub_library_backup",
                     "restore_hub_library_backup"):
            self.assertTrue(callable(getattr(plugin, name)))


if __name__ == "__main__":
    unittest.main()

"""Collections are independent of tabs, Steam and the Decky frontend."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import collection_manager
import tab_manager
import main


class CollectionManagerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        for module, attr, path in (
            (collection_manager, "FILE", root / "collections.json"),
            (tab_manager, "SETTINGS_FILE", root / "modules.json"),
            (tab_manager, "TABS_FILE", root / "tabs.json"),
            (tab_manager, "PROFILES_FILE", root / "profiles.json"),
        ):
            patcher = patch.object(module, attr, path)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_collection_isolated_from_card(self):
        stored = collection_manager.save_collections([
            {"id": "rpg", "title": "RPG", "filter": "manual", "app_ids": ["123", "123", "4294967295"]}
        ])
        self.assertEqual(stored[0]["app_ids"], ["123", "4294967295"])
        tab_manager.save_tabs([{
            "id": "rpg-tab", "title": "Gry RPG", "filter": "hub_collection", "collection_id": "rpg"
        }])
        tab_manager.save_tabs([])
        self.assertEqual(collection_manager.read_collections(), stored)
        self.assertEqual(tab_manager.read_tabs(), [])

    def test_renaming_does_not_modify_card(self):
        tab_manager.save_tabs([{
            "id": "rpg-tab", "title": "RPG", "filter": "hub_collection", "collection_id": "rpg"
        }])
        collection_manager.save_collections([{"id": "rpg", "title": "RPG"}])
        collection_manager.save_collections([{"id": "rpg", "title": "Przygody"}])
        self.assertEqual(tab_manager.read_tabs()[0]["collection_id"], "rpg")

    def test_dynamic_filters(self):
        for filter_name in ("manual", "all", "installed", "favorites", "non_steam"):
            entry = collection_manager.save_collections([{"id": "x", "title": "Kolekcja", "filter": filter_name}])
            self.assertEqual(entry[0]["filter"], filter_name)

    def test_reject_bad_collection_and_ids(self):
        for bad in (
            [{"id": "bad/id", "title": "Nie"}],
            [{"id": "ok", "title": " "}],
            [{"id": "ok", "title": "Ok", "filter": "untrusted"}],
            [{"id": "ok", "title": "Ok", "app_ids": ["../../foo"]}],
            [{"id": "ok", "title": "Ok", "app_ids": ["0"]}],
            [{"id": "same", "title": "A"}, {"id": "same", "title": "B"}],
        ):
            with self.assertRaises(ValueError):
                collection_manager.save_collections(bad)

    def test_invalid_json_is_not_replaced(self):
        collection_manager.FILE.parent.mkdir(parents=True, exist_ok=True)
        collection_manager.FILE.write_text('{"version":2,"collections":[]}', encoding="utf-8")
        with self.assertRaises(ValueError):
            collection_manager.read_collections()
        self.assertIn('"version":2', collection_manager.FILE.read_text(encoding="utf-8"))

    def test_backend_exposes_methods(self):
        plugin = main.Plugin()
        for name in (
            "get_hub_collections", "save_hub_collections",
            "get_tab_manager_enabled", "set_tab_manager_enabled", "get_tab_definitions",
            "save_tab_definitions", "list_tab_profiles", "save_tab_profile",
            "load_tab_profile", "delete_tab_profile"
        ):
            self.assertTrue(callable(getattr(plugin, name)), name)


if __name__ == "__main__":
    unittest.main()

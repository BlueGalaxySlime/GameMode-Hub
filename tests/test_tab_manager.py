"""Unit tests for SteamHub Tab Manager backend (python -m unittest discover -s tests)."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import tab_manager


class TabManagerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.settings = patch.object(tab_manager, "SETTINGS_FILE", base / "modules.json")
        self.tabs = patch.object(tab_manager, "TABS_FILE", base / "tabs.json")
        self.settings.start()
        self.tabs.start()
        self.profiles = patch.object(tab_manager, "PROFILES_FILE", base / "profiles.json")
        self.profiles.start()
        self.addCleanup(self.settings.stop)
        self.addCleanup(self.tabs.stop)
        self.addCleanup(self.profiles.stop)

    def test_default_disabled(self):
        self.assertFalse(tab_manager._read_tab_manager_enabled())

    def test_settings_survive_other_fields(self):
        tab_manager.SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        tab_manager.SETTINGS_FILE.write_text('{"other_module":true}', encoding="utf-8")
        tab_manager._write_tab_manager_enabled(True)
        self.assertTrue(tab_manager._read_tab_manager_enabled())
        self.assertTrue(json.loads(tab_manager.SETTINGS_FILE.read_text())["other_module"])

    def test_invalid_settings_do_not_crash(self):
        tab_manager.SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        tab_manager.SETTINGS_FILE.write_text("[]", encoding="utf-8")
        self.assertFalse(tab_manager._read_tab_manager_enabled())

    def test_tabs_roundtrip_and_order(self):
        tabs = [{"id": "a", "title": "First", "hidden": False},
                {"id": "b", "title": "Second", "hidden": True}]
        self.assertEqual(tab_manager.save_tabs(tabs), tab_manager.read_tabs())
        self.assertEqual(tab_manager.save_tabs(list(reversed(tabs)))[0]["id"], "b")

    def test_filters_persist(self):
        tabs = [{"id": "fav", "title": "Ulubione", "filter": "favorites"}]
        self.assertEqual(tab_manager.save_tabs(tabs)[0]["filter"], "favorites")
        self.assertEqual(tab_manager.read_tabs()[0]["filter"], "favorites")

    def test_reject_unknown_filter(self):
        with self.assertRaises(ValueError):
            tab_manager.save_tabs([{"id": "x", "title": "A", "filter": "unknown"}])

    def test_reject_incomplete_collection_filter(self):
        with self.assertRaises(ValueError):
            tab_manager.save_tabs([{"id": "x", "title": "A", "filter": "collection"}])

    def test_profile_roundtrip_without_losing_tabs(self):
        original = [{"id": "fav", "title": "Ulubione", "filter": "favorites"}]
        tab_manager.save_tabs(original)
        self.assertEqual(tab_manager.save_tab_profile("Mój profil"), ["Mój profil"])
        tab_manager.save_tabs([])
        restored = tab_manager.load_tab_profile("Mój profil")
        self.assertEqual(restored[0]["filter"], "favorites")
        self.assertEqual(tab_manager.read_tabs(), restored)
        self.assertEqual(tab_manager.delete_tab_profile("Mój profil"), [])
        self.assertEqual(tab_manager.read_tabs(), restored)

    def test_invalid_profile_name(self):
        with self.assertRaises(ValueError):
            tab_manager.save_tab_profile("  ")

    def test_reject_duplicate_ids(self):
        with self.assertRaises(ValueError):
            tab_manager.save_tabs([{"id": "x", "title": "A"}, {"id": "x", "title": "B"}])

    def test_reject_nonboolean_hidden(self):
        with self.assertRaises(ValueError):
            tab_manager.save_tabs([{"id": "x", "title": "A", "hidden": "false"}])


if __name__ == "__main__":
    unittest.main()

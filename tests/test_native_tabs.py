"""Steam-owned library tabs may be hidden only, never deleted or renamed."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from backend.library import tab_manager


class NativeTabsTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        p = patch.object(tab_manager, "HIDDEN_STEAM_TABS_FILE", Path(folder.name) / "hidden_steam_tabs.json")
        p.start()
        self.addCleanup(p.stop)

    def test_native_visibility_roundtrip(self):
        self.assertEqual(tab_manager.read_hidden_steam_tabs(), [])
        self.assertEqual(tab_manager.save_hidden_steam_tabs(["AllGames", "Installed", "AllGames"]),
                         ["AllGames", "Installed"])
        self.assertEqual(tab_manager.read_hidden_steam_tabs(), ["AllGames", "Installed"])
        self.assertEqual(tab_manager.save_hidden_steam_tabs(["Installed"]), ["Installed"])
        self.assertEqual(tab_manager.read_hidden_steam_tabs(), ["Installed"])

    def test_no_hub_ids_in_native_store(self):
        for key in ("GameModeHub:abc", "SteamHub:tab", "steamhub:tab", "../AllGames"):
            with self.assertRaises(ValueError):
                tab_manager.save_hidden_steam_tabs([key])

    def test_system_alias_is_a_hub_owned_tab_with_stable_reference(self):
        original = [{
            "id": "alias-1", "title": "Moje zainstalowane", "filter": "system_tab",
            "collection_id": "Installed"
        }]
        clean = tab_manager._validate_tabs(original)
        self.assertEqual(clean[0]["collection_id"], "Installed")
        self.assertEqual(clean[0]["filter"], "system_tab")

    def test_system_tab_alias_requires_original_id(self):
        with self.assertRaises(ValueError):
            tab_manager._validate_tabs([{
                "id": "alias-1", "title": "Puste", "filter": "system_tab",
                "collection_id": ""
            }])


if __name__ == "__main__":
    unittest.main()

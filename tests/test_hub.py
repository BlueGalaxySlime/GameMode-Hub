"""Independent selection settings: never alter other plugins in Decky."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.core import hub_settings


class HubSelectionTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.TemporaryDirectory()
        self.addCleanup(self.root.cleanup)
        self.patcher = patch.object(hub_settings, "SELECTION_FILE", Path(self.root.name) / "addons.json")
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_default_is_empty(self):
        self.assertEqual(hub_settings.get_selected_addons(), [])

    def test_save_survives_restart_and_keeps_order(self):
        selected = ["Decky Terminal", "Decky Manager"]
        self.assertEqual(hub_settings.set_selected_addons(selected), selected)
        self.assertEqual(hub_settings.get_selected_addons(), selected)

    def test_deduplicate_and_exclude_steamhub_itself(self):
        self.assertEqual(
            hub_settings.set_selected_addons(["Decky Terminal", "SteamHub", "GameModeHub", "GameMode Hub", "Decky Terminal"]),
            ["Decky Terminal"]
        )

    def test_does_not_create_other_plugin_settings(self):
        hub_settings.set_selected_addons(["TabMaster"])
        self.assertEqual(json.loads(hub_settings.SELECTION_FILE.read_text()), ["TabMaster"])
        self.assertEqual(list(hub_settings.SELECTION_FILE.parent.iterdir()), [hub_settings.SELECTION_FILE])

    def test_update_channel_persists_with_default_test_and_rejects_invalid(self):
        with patch.object(hub_settings, "UPDATE_CHANNEL_FILE", Path(self.root.name) / "channel.json"):
            self.assertEqual(hub_settings.get_update_channel(), "test")
            self.assertEqual(hub_settings.set_update_channel("stable"), "stable")
            self.assertEqual(hub_settings.get_update_channel(), "stable")
            with self.assertRaises(ValueError):
                hub_settings.set_update_channel("nightly")

    def test_hub_options_defaults_persist_and_validate(self):
        with patch.object(hub_settings, "HUB_PREFERENCES_FILE", Path(self.root.name) / "prefs.json"):
            defaults = {"saveSession": True, "splitFileTree": False, "autoKeyboard": True,
                        "developerMode": False}
            self.assertEqual(hub_settings.get_hub_preferences(), defaults)
            chosen = {"saveSession": False, "splitFileTree": True, "autoKeyboard": False,
                      "developerMode": True}
            self.assertEqual(hub_settings.set_hub_preferences(chosen), chosen)
            self.assertEqual(hub_settings.get_hub_preferences(), chosen)
            for bad in ({}, {"saveSession": "false", "splitFileTree": True},
                        {"autoKeyboard": "false"}, {"developerMode": "false"},
                        {"saveSession": True, "splitFileTree": False, "extra": 1}):
                with self.subTest(bad=bad), self.assertRaises(ValueError):
                    hub_settings.set_hub_preferences(bad)

    def test_hub_options_migrate_two_key_prefs_without_resetting_split(self):
        path = Path(self.root.name) / "prefs.json"
        with patch.object(hub_settings, "HUB_PREFERENCES_FILE", path):
            path.write_text(json.dumps({"saveSession": False, "splitFileTree": True}))
            self.assertEqual(hub_settings.get_hub_preferences(),
                             {"saveSession": False, "splitFileTree": True, "autoKeyboard": True,
                               "developerMode": False})
            saved = hub_settings.set_hub_preferences({
                "saveSession": False, "splitFileTree": True, "autoKeyboard": False
            })
            self.assertFalse(saved["autoKeyboard"])
            self.assertEqual(hub_settings.get_hub_preferences(), saved)

    def test_favorite_folders_persist_and_reject_escaping_home(self):
        from backend.files import file_manager
        home = Path(self.root.name) / "home"
        home.mkdir()
        mods = home / "Mod manager"
        mods.mkdir()
        with patch.object(file_manager, "_allowed_roots", return_value=[("Dom", home)]), \
             patch.object(hub_settings, "FAVORITE_FOLDERS_FILE", Path(self.root.name) / "favs.json"):
            self.assertEqual(hub_settings.get_favorite_folders(), [])
            self.assertEqual(hub_settings.set_favorite_folders([str(mods)]), [str(mods)])
            self.assertEqual(hub_settings.get_favorite_folders(), [str(mods)])
            with self.assertRaises(PermissionError):
                hub_settings.set_favorite_folders([str(Path(self.root.name))])
            with self.assertRaises(ValueError):
                hub_settings.set_favorite_folders(["relative/path"])
            self.assertEqual(hub_settings.set_favorite_folders([]), [])

    def test_reject_invalid_input(self):
        for invalid in ("a", {}, [8], [""], ["x" * 101]):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                hub_settings.set_selected_addons(invalid)


if __name__ == "__main__":
    unittest.main()

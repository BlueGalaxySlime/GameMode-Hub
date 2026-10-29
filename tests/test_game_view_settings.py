import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.library import game_view_settings as settings


class UnifiedUiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "game_view.json"
        patcher = patch.object(settings, "FILE", self.path)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_opt_in_default_and_persistent_preferences(self):
        self.assertEqual(settings.get_options(), {"enabled": False, "show_protondb": True})
        self.assertEqual(settings.set_options({"enabled": True, "show_protondb": False}),
                         {"enabled": True, "show_protondb": False})
        self.assertEqual(settings.get_options()["enabled"], True)
        with self.assertRaises(ValueError):
            settings.set_options({"enabled": 1, "show_protondb": True})
        with self.assertRaises(ValueError):
            settings.set_options({"enabled": True})
        with self.assertRaises(ValueError):
            settings.set_options({"enabled": False, "show_protondb": True, "root": True})
        self.assertEqual(self.path.parent, Path(self.tmp.name))

    def test_native_steam_games_not_rewritten(self):
        self.assertEqual(settings.get_mapping("620"),
                         {"client": "steam", "steam_id": "620"})
        with self.assertRaises(ValueError):
            settings.set_mapping("620", "gog", "620")

    def test_gog_shortcut_mapping_persists_and_does_not_modify_launcher(self):
        shortcut = "3221225472"
        self.assertEqual(settings.get_mapping(shortcut),
                         {"client": None, "steam_id": None})
        mapped = settings.set_mapping(shortcut, "gog", "620")
        self.assertEqual(mapped, {"client": "gog", "steam_id": "620"})
        content = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual(content["games"][shortcut]["client"], "gog")
        self.assertEqual(settings.get_mapping(shortcut), mapped)
        self.assertNotIn("launch", str(content).lower())

    def test_invalid_appids_and_unknown_source_fail_closed(self):
        for invalid in (-1, 0, "0", "abc", "99999999999", True, None):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                settings.get_mapping(invalid)
        with self.assertRaises(ValueError):
            settings.set_mapping("3221225472", "unknown", "620")
        with self.assertRaises(ValueError):
            settings.set_mapping("3221225472", "gog", "3221225472")
        with self.assertRaises(ValueError):
            settings.set_mapping("3221225472", "gog", "abc")

    def test_more_sources_without_credentials(self):
        shortcut = "3221225472"
        for source in ("amazon", "ubisoft", "battlenet", "itch", "xcloud"):
            with self.subTest(source=source):
                self.assertEqual(settings.set_mapping(shortcut, source)["client"], source)
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertNotIn("token", str(data).lower())

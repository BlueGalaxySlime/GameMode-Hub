"""Ensure backend modules stay importable and out of the repository root."""
import importlib
from pathlib import Path
import unittest

MODULES = {
    "core": ("hub_settings", "release_catalog", "runtime_state"),
    "files": ("file_manager", "trash_manager", "lan_transfer"),
    "apps": ("desktop_apps", "flatpak_manager"),
    "downloads": ("downloads_manager", "update_checks"),
    "library": ("tab_manager", "collection_manager", "library_backup",
                "game_view_settings", "protondb_badges"),
}

ROOT = Path(__file__).resolve().parent.parent

class BackendLayoutTests(unittest.TestCase):
    def test_services_are_nested_and_importable(self):
        for group, names in MODULES.items():
            self.assertTrue((ROOT / "backend" / group / "__init__.py").is_file())
            for name in names:
                with self.subTest(module=name):
                    self.assertFalse((ROOT / (name + ".py")).exists())
                    self.assertTrue((ROOT / "backend" / group / (name + ".py")).is_file())
                    self.assertIsNotNone(importlib.import_module("backend." + group + "." + name))

    def test_required_entrypoint_is_unchanged(self):
        self.assertTrue((ROOT / "main.py").is_file())
        self.assertTrue((ROOT / "plugin.json").is_file())
        self.assertFalse((ROOT / "modules" / "example.manifest.json").exists())

if __name__ == "__main__":
    unittest.main()

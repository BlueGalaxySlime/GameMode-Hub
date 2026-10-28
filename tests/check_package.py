"""Validate the Decky ZIP root and verify that unsafe PTY files stay out."""
from pathlib import Path
from zipfile import ZipFile
import json
import unittest

class PackageTests(unittest.TestCase):
    def test_gamemode_hub_identity_and_safe_package(self):
        archive=Path("release/GameMode-Hub.zip")
        self.assertTrue(archive.is_file())
        with ZipFile(archive) as z:
            names=z.namelist()
            self.assertIn("GameMode Hub/plugin.json",names)
            data=json.loads(z.read("GameMode Hub/plugin.json"))
            self.assertEqual(data["name"],"GameMode Hub")
            self.assertIn("GameMode Hub/main.py",names)
            self.assertIn("GameMode Hub/release_catalog.py",names)
            self.assertIn("GameMode Hub/file_manager.py",names)
            self.assertIn("GameMode Hub/lan_transfer.py",names)
            self.assertIn("GameMode Hub/flatpak_manager.py",names)
            self.assertTrue(any(name.startswith("GameMode Hub/dist/") and name.endswith(".js") for name in names))
            self.assertFalse(any(name.startswith("GameMode Hub/terminal_core/") for name in names))
            self.assertFalse(any(name.startswith("GameMode Hub/desktop/") for name in names))

if __name__=="__main__":
    unittest.main()

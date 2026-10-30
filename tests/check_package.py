"""Validate the Decky ZIP root and the bundled, on-demand PTY service."""
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
            self.assertIn("GameMode Hub/backend/__init__.py",names)
            self.assertFalse(any(name.startswith("GameMode Hub/") and name.endswith(".py")
                and name.count("/") == 1 and name != "GameMode Hub/main.py" for name in names))
            self.assertIn("GameMode Hub/backend/core/release_catalog.py",names)
            self.assertIn("GameMode Hub/backend/files/file_manager.py",names)
            self.assertIn("GameMode Hub/backend/files/lan_transfer.py",names)
            self.assertIn("GameMode Hub/backend/apps/flatpak_manager.py",names)
            self.assertIn("GameMode Hub/backend/downloads/downloads_manager.py",names)
            self.assertIn("GameMode Hub/backend/downloads/update_checks.py",names)
            self.assertIn("GameMode Hub/backend/core/runtime_state.py",names)
            self.assertIn("GameMode Hub/backend/library/protondb_badges.py",names)
            self.assertIn("GameMode Hub/backend/library/game_view_settings.py",names)
            self.assertIn("GameMode Hub/backend/library/tab_manager.py",names)
            self.assertIn("GameMode Hub/backend/library/collection_manager.py",names)
            self.assertIn("GameMode Hub/backend/library/library_backup.py",names)
            self.assertTrue(any(name.startswith("GameMode Hub/dist/") and name.endswith(".js") for name in names))
            self.assertIn("GameMode Hub/terminal_core/service.py", names)
            self.assertIn("GameMode Hub/terminal_core/worker.py", names)
            self.assertFalse(any(name.startswith("GameMode Hub/desktop/") for name in names))

if __name__=="__main__":
    unittest.main()

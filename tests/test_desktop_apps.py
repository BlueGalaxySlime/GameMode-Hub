"""Application discovery and settings are independent of a live Decky/Steam client."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import desktop_apps


class DesktopAppsTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.apps = self.root / "applications"
        self.apps.mkdir()
        patcher = patch.object(desktop_apps, "application_directories", return_value=[self.apps])
        patcher.start()
        self.addCleanup(patcher.stop)
        patcher = patch.object(desktop_apps, "STATE_FILE", self.root / "desktop.json")
        patcher.start()
        self.addCleanup(patcher.stop)

    def desktop_file(self, filename, content):
        (self.apps / filename).write_text("[Desktop Entry]\n" + content, encoding="utf-8")

    def test_applications_from_desktop_files(self):
        self.desktop_file("org.test.App.desktop",
            "Type=Application\nName=Test App\nName[pl]=Testowa aplikacja\n"
            "Exec=flatpak run org.test.App %U\nX-Flatpak=org.test.App\n")
        self.desktop_file("hidden.desktop",
            "Type=Application\nName=Hidden\nExec=hidden\nNoDisplay=true\n")
        self.desktop_file("terminal.desktop",
            "Type=Application\nName=Terminal\nExec=xterm\nTerminal=true\n")
        found = desktop_apps.list_desktop_apps()
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["name"], "Testowa aplikacja")
        self.assertEqual(found[0]["bin"], "flatpak")
        self.assertEqual(found[0]["cmd"], "run org.test.App")
        self.assertTrue(found[0]["flatpak"])

    def test_invalid_exec_and_non_application_rejected(self):
        self.desktop_file("bad.desktop",
            "Type=Application\nName=Bad\nExec=\n")
        self.desktop_file("other.desktop",
            "Type=Link\nName=Other\nExec=true\n")
        self.assertEqual(desktop_apps.list_desktop_apps(), [])

    def test_saved_favorites_shortcuts_and_stale_cleanup(self):
        self.assertEqual(desktop_apps.get_desktop_state(), {"apps": {}, "temporary": []})
        desktop_apps.set_desktop_setting("org.test.App", "favorite", True)
        desktop_apps.set_desktop_setting("org.test.App", "shortcut", 123)
        desktop_apps.remember_temporary_shortcut(456)
        self.assertTrue(desktop_apps.get_desktop_state()["apps"]["org.test.App"]["favorite"])
        self.assertEqual(desktop_apps.get_desktop_state()["apps"]["org.test.App"]["shortcut"], 123)
        self.assertEqual(desktop_apps.get_desktop_state()["temporary"], [456])
        desktop_apps.forget_temporary_shortcut(456)
        self.assertEqual(desktop_apps.get_desktop_state()["temporary"], [])

    def test_auto_classifies_flatpak_run_without_x_flatpak_marker(self):
        self.desktop_file("flat.desktop", "Type=Application\nName=Flat Test\n"
                          "Exec=/usr/bin/flatpak run org.example.Test %U\n")
        found = desktop_apps.list_desktop_apps()
        self.assertEqual(len(found), 1)
        self.assertTrue(found[0]["flatpak"])

    def test_category_override_persists_and_is_validated(self):
        value = desktop_apps.set_desktop_setting("org.example.Test", "category", "flatpak")
        self.assertEqual(value["category"], "flatpak")
        self.assertEqual(desktop_apps.get_desktop_state()["apps"]["org.example.Test"]["category"],
                         "flatpak")
        desktop_apps.set_desktop_setting("org.example.Test", "category", "auto")
        self.assertEqual(desktop_apps.get_desktop_state()["apps"]["org.example.Test"]["category"],
                         "auto")
        with self.assertRaises(ValueError):
            desktop_apps.set_desktop_setting("org.example.Test", "category", "hidden")

    def test_invalid_preferences_rejected(self):
        for value in ("not bool", None, 1):
            with self.subTest(value=value), self.assertRaises(ValueError):
                desktop_apps.set_desktop_setting("test", "favorite", value)
        with self.assertRaises(ValueError):
            desktop_apps.set_desktop_setting("../other", "forbidden", True)
        for value in (-1, 0, "3", True):
            with self.subTest(value=value), self.assertRaises(ValueError):
                desktop_apps.remember_temporary_shortcut(value)


if __name__ == "__main__":
    unittest.main()

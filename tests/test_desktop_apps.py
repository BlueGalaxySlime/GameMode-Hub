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
        self.assertEqual(desktop_apps.get_desktop_state(), {"apps": {}, "temporary": [], "views": []})
        desktop_apps.set_desktop_setting("org.test.App", "favorite", True)
        desktop_apps.set_desktop_setting("org.test.App", "shortcut", 123)
        desktop_apps.remember_temporary_shortcut(456)
        self.assertTrue(desktop_apps.get_desktop_state()["apps"]["org.test.App"]["favorite"])
        self.assertEqual(desktop_apps.get_desktop_state()["apps"]["org.test.App"]["shortcut"], 123)
        self.assertEqual(desktop_apps.get_desktop_state()["temporary"], [456])
        desktop_apps.forget_temporary_shortcut(456)
        self.assertEqual(desktop_apps.get_desktop_state()["temporary"], [])

    def test_display_profile_is_saved_and_reversible(self):
        app_id = "org.mozilla.firefox"
        saved = desktop_apps.set_desktop_setting(app_id, "display_profile", "native")
        self.assertEqual(saved["display_profile"], "native")
        self.assertEqual(desktop_apps.get_desktop_state()["apps"][app_id]["display_profile"], "native")
        desktop_apps.set_desktop_setting(app_id, "display_profile", "default")
        self.assertEqual(desktop_apps.get_desktop_state()["apps"][app_id]["display_profile"], "default")
        for bad in ("1280x800", "fullscreen", "auto", None, True):
            with self.assertRaises(ValueError):
                desktop_apps.set_desktop_setting(app_id, "display_profile", bad)

    def test_legacy_compact_mode_is_safely_retired(self):
        app_id = "org.mozilla.firefox"
        desktop_apps.set_desktop_setting(app_id, "window_profile", "compact")
        self.assertEqual(desktop_apps.get_desktop_state()["apps"][app_id]["window_profile"], "system")

    def test_auto_classifies_flatpak_run_without_x_flatpak_marker(self):
        self.desktop_file("flat.desktop", "Type=Application\nName=Flat Test\n"
                          "Exec=/usr/bin/flatpak run org.example.Test %U\n")
        found = desktop_apps.list_desktop_apps()
        self.assertEqual(len(found), 1)
        self.assertTrue(found[0]["flatpak"])

    def test_installed_firefox_flatpak_export_symlink_is_discovered(self):
        """Flatpak exports its desktop files as links; SteamOS has a separate installer icon."""
        install_root = self.root / ".local/share/flatpak"
        exported = install_root / "exports/share/applications"
        exported.mkdir(parents=True)
        installed_file = (install_root /
            "app/org.mozilla.firefox/x86_64/stable/active/export/share/applications/org.mozilla.firefox.desktop")
        installed_file.parent.mkdir(parents=True)
        installed_file.write_text(
            "[Desktop Entry]\nType=Application\nName=Firefox\n"
            "Exec=/usr/bin/flatpak run --branch=stable org.mozilla.firefox %U\n"
            "X-Flatpak=org.mozilla.firefox\n", encoding="utf-8"
        )
        (exported / "org.mozilla.firefox.desktop").symlink_to(installed_file)
        self.desktop_file("install-firefox.desktop",
            "Type=Application\nName=Install Firefox\nExec=discover\n")
        with patch.dict("os.environ", {"DECKY_USER_HOME": str(self.root)}), \
             patch.object(desktop_apps, "application_directories",
                          return_value=[self.apps, exported]):
            found = desktop_apps.list_desktop_apps()
        firefox = next(app for app in found if app["id"] == "org.mozilla.firefox")
        self.assertEqual(firefox["name"], "Firefox")
        self.assertEqual(firefox["bin"], "/usr/bin/flatpak")
        self.assertIn("org.mozilla.firefox", firefox["cmd"])
        self.assertTrue(firefox["flatpak"])
        self.assertEqual(len(found), 2)

    def test_symlink_desktop_files_outside_flatpak_export_remain_blocked(self):
        install_root = self.root / ".local/share/flatpak"
        exported = install_root / "exports/share/applications"
        exported.mkdir(parents=True)
        target = self.root / "untrusted.desktop"
        target.write_text(
            "[Desktop Entry]\nType=Application\nName=Untrusted\nExec=anything\n",
            encoding="utf-8"
        )
        (self.apps / "untrusted.desktop").symlink_to(target)
        (exported / "org.example.Evil.desktop").symlink_to(target)
        with patch.dict("os.environ", {"DECKY_USER_HOME": str(self.root)}), \
             patch.object(desktop_apps, "application_directories",
                          return_value=[self.apps, exported]):
            self.assertEqual(desktop_apps.list_desktop_apps(), [])

    def test_broken_flatpak_export_link_is_ignored(self):
        install_root = self.root / ".local/share/flatpak"
        exported = install_root / "exports/share/applications"
        exported.mkdir(parents=True)
        (exported / "org.example.Missing.desktop").symlink_to(
            install_root / "app/org.example.Missing/missing.desktop"
        )
        with patch.dict("os.environ", {"DECKY_USER_HOME": str(self.root)}), \
             patch.object(desktop_apps, "application_directories",
                          return_value=[exported]):
            self.assertEqual(desktop_apps.list_desktop_apps(), [])

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

    def test_reset_categories_preserves_favorites_hidden_shortcuts(self):
        desktop_apps.set_desktop_setting("first", "favorite", True)
        desktop_apps.set_desktop_setting("first", "shortcut", 123)
        desktop_apps.set_desktop_setting("first", "category", "flatpak")
        desktop_apps.set_desktop_setting("second", "hidden", True)
        desktop_apps.set_desktop_setting("second", "category", "system")
        desktop_apps.set_desktop_setting("third", "category", "auto")
        desktop_apps.remember_temporary_shortcut(456)
        result = desktop_apps.reset_desktop_categories()
        self.assertEqual(result["reset"], 2)
        self.assertEqual(result["state"], desktop_apps.get_desktop_state())
        self.assertEqual(result["state"]["apps"]["first"]["category"], "auto")
        self.assertTrue(result["state"]["apps"]["first"]["favorite"])
        self.assertEqual(result["state"]["apps"]["first"]["shortcut"], 123)
        self.assertTrue(result["state"]["apps"]["second"]["hidden"])
        self.assertEqual(result["state"]["apps"]["third"]["category"], "auto")
        self.assertEqual(result["state"]["temporary"], [456])
        self.assertEqual(desktop_apps.reset_desktop_categories()["reset"], 0)

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

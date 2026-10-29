"""Regression tests for user-created desktop views and fixed built-in views."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import desktop_apps


class DesktopCustomViewsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = patch.object(desktop_apps, "STATE_FILE",
                               Path(self.tmp.name) / "desktop_apps.json")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_custom_view_lifecycle_does_not_modify_app_preferences(self):
        desktop_apps.set_desktop_setting("com.example.Test", "hidden", True)
        created = desktop_apps.manage_desktop_view("create", name="Moje")
        view_id = created["view_id"]
        self.assertEqual(created["views"][0]["appIds"], [])

        added = desktop_apps.manage_desktop_view("toggle_app",
                                                  view_id=view_id,
                                                  app_id="com.example.Test")
        self.assertEqual(added["views"][0]["appIds"], ["com.example.Test"])
        renamed = desktop_apps.manage_desktop_view("rename", view_id=view_id,
                                                    name="Ulubione gry")
        self.assertEqual(renamed["views"][0]["name"], "Ulubione gry")
        removed = desktop_apps.manage_desktop_view("toggle_app",
                                                    view_id=view_id,
                                                    app_id="com.example.Test")
        self.assertEqual(removed["views"][0]["appIds"], [])
        deleted = desktop_apps.manage_desktop_view("delete", view_id=view_id)
        self.assertEqual(deleted["views"], [])
        self.assertTrue(desktop_apps.get_desktop_state()["apps"]
                        ["com.example.Test"]["hidden"])

    def test_protected_default_views_have_no_editable_ids(self):
        for action in ("rename", "delete", "toggle_app"):
            with self.subTest(action=action):
                with self.assertRaises(ValueError):
                    desktop_apps.manage_desktop_view(
                        action, view_id="all", name="Oops", app_id="firefox")
        self.assertEqual(desktop_apps.get_desktop_state()["views"], [])

    def test_invalid_names_and_duplicate_names_rejected(self):
        desktop_apps.manage_desktop_view("create", name=" Gry ")
        with self.assertRaises(ValueError):
            desktop_apps.manage_desktop_view("create", name="gry")
        with self.assertRaises(ValueError):
            desktop_apps.manage_desktop_view("create", name=" " * 4)
        with self.assertRaises(ValueError):
            desktop_apps.manage_desktop_view("create", name="X" * 51)

    def test_existing_preferences_migrate_without_views(self):
        state_file = desktop_apps.STATE_FILE
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps({"apps": {"firefox": {"favorite": True}},
                                          "temporary": []}), encoding="utf8")
        state = desktop_apps.get_desktop_state()
        self.assertEqual(state["views"], [])
        self.assertTrue(state["apps"]["firefox"]["favorite"])


if __name__ == "__main__":
    unittest.main()

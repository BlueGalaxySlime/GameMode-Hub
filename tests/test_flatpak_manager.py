"""Flatpak safety: no root, no shell, no system update, no arbitrary refs."""
import unittest
from unittest.mock import patch, Mock
import flatpak_manager as fm


class FlatpakTests(unittest.TestCase):
    def test_overview_reports_installed_and_updates(self):
        def fake_run(args, timeout=25):
            if args[0] == "list":
                return Mock(returncode=0, stdout="org.example.App\tuser\tflathub\tstable\t1.0\n"
                    "org.example.Other\tsystem\tflathub\tstable\t2.0\n")
            if args[0] == "remote-ls":
                return Mock(returncode=0, stdout="org.example.App\norg.example.Other\n")
            raise AssertionError(args)
        with patch.object(fm.os, "geteuid", return_value=1000), patch.object(fm, "_run", side_effect=fake_run):
            result = fm.flatpak_overview()
        self.assertEqual(len(result["apps"]), 2)
        self.assertTrue(all(app["updateable"] for app in result["apps"]))

    def test_user_only_update_requires_installed_user_app(self):
        called = []
        def fake_run(args, timeout=25):
            called.append(args)
            if args[0] == "list":
                return Mock(returncode=0, stdout="org.example.App\tuser\norg.example.Other\tsystem\n")
            return Mock(returncode=0, stdout="")
        with patch.object(fm.os, "geteuid", return_value=1000), patch.object(fm, "_run", side_effect=fake_run):
            with self.assertRaises(PermissionError):
                fm.flatpak_update_user("org.example.Other")
            with self.assertRaises(ValueError):
                fm.flatpak_update_user("; rm -rf /")
            result = fm.flatpak_update_user("org.example.App")
        self.assertTrue(result["updated"])
        self.assertEqual(called[-1], ["--user", "update", "--app", "--noninteractive",
                                      "--assumeyes", "org.example.App"])

    def test_no_root(self):
        with patch.object(fm.os, "geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                fm.flatpak_overview()
            with self.assertRaises(PermissionError):
                fm.flatpak_update_user("org.example.App")


if __name__ == "__main__":
    unittest.main()

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


class FlatpakBulkTests(unittest.TestCase):
    def test_bulk_updates_user_apps_without_shell_or_system(self):
        calls = []
        def fake_run(args, timeout=25):
            calls.append(args)
            if args[0] == "list":
                return Mock(returncode=0, stdout="org.example.App\tuser\norg.example.System\tsystem\n")
            return Mock(returncode=0, stdout="")
        with patch.object(fm.os, "geteuid", return_value=1000), patch.object(fm, "_run", side_effect=fake_run):
            self.assertTrue(fm.flatpak_update_all_user()["updated"])
        self.assertEqual(calls[-1], ["--user", "update", "--app", "--noninteractive", "--assumeyes"])

    def test_bulk_does_not_touch_system_only_apps(self):
        def fake_run(args, timeout=25):
            if args[0] != "list":
                raise AssertionError("Unexpected bulk Flatpak operation")
            return Mock(returncode=0, stdout="org.example.System\tsystem\n")
        with patch.object(fm.os, "geteuid", return_value=1000), patch.object(fm, "_run", side_effect=fake_run):
            self.assertFalse(fm.flatpak_update_all_user()["updated"])

    def test_bulk_rejects_root(self):
        with patch.object(fm.os, "geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                fm.flatpak_update_all_user()



class FlatpakTaskTests(unittest.TestCase):
    def test_start_is_nonblocking_cancel_available(self):
        import threading
        import time
        entered = threading.Event()
        allow_exit = threading.Event()

        class FakeProc:
            pid = 123456
            returncode = -15

            def communicate(self, timeout=None):
                entered.set()
                allow_exit.wait(2)
                return b"", None

            def terminate(self):
                allow_exit.set()

            def kill(self):
                allow_exit.set()

        task = fm.FlatpakUpdateTask()
        with patch.object(fm.os, "geteuid", return_value=1000), \
             patch.object(fm, "_installed", return_value=[
                 {"id": "com.microsoft.Edge", "installation": "user"}]), \
             patch.object(fm.subprocess, "Popen", return_value=FakeProc()) as spawn, \
             patch.object(fm.os, "killpg", side_effect=lambda pid, sig: allow_exit.set()):
            response = task.start("com.microsoft.Edge")
            self.assertIn(response["state"], ("preparing", "running"))
            self.assertTrue(entered.wait(2))
            self.assertEqual(spawn.call_args.kwargs["start_new_session"], True)
            self.assertEqual(spawn.call_args.args[0],
                ["flatpak", "--user", "update", "--noninteractive",
                 "--assumeyes", "com.microsoft.Edge"])
            task.cancel()
            for _ in range(50):
                if task.status()["state"] == "cancelled":
                    break
                time.sleep(0.01)
            self.assertEqual(task.status()["state"], "cancelled")

    def test_all_updates_in_one_command_including_runtimes(self):
        import threading
        import time
        entered = threading.Event()

        class QuickProc:
            pid = 34567
            returncode = 0

            def communicate(self, timeout=None):
                entered.set()
                return b"", None

        task = fm.FlatpakUpdateTask()
        with patch.object(fm.os, "geteuid", return_value=1000), \
             patch.object(fm, "_installed", return_value=[
                 {"id": "org.test.One", "installation": "user"},
                 {"id": "org.test.Two", "installation": "user"},
                 {"id": "org.test.System", "installation": "system"}]), \
             patch.object(fm.subprocess, "Popen", return_value=QuickProc()) as spawn:
            task.start()
            self.assertTrue(entered.wait(2))
            for _ in range(50):
                if task.status()["state"] == "success":
                    break
                time.sleep(0.01)
            self.assertEqual(task.status()["state"], "success")
        self.assertEqual(spawn.call_count, 1)
        self.assertEqual(spawn.call_args.args[0],
            ["flatpak", "--user", "update", "--noninteractive", "--assumeyes"])

    def test_root_invalid_ids_and_overlapping_jobs_are_rejected(self):
        import threading
        ready = threading.Event()
        proceed = threading.Event()
        task = fm.FlatpakUpdateTask()

        def hold():
            ready.set()
            proceed.wait(2)
            return [{"id": "org.test.One", "installation": "user"}]

        with patch.object(fm.os, "geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                task.start()
        with patch.object(fm.os, "geteuid", return_value=1000):
            with self.assertRaises(ValueError):
                task.start("; echo wrong")
        with patch.object(fm.os, "geteuid", return_value=1000), \
             patch.object(fm, "_installed", side_effect=hold):
            task.start("org.test.One")
            self.assertTrue(ready.wait(2))
            with self.assertRaises(RuntimeError):
                task.start("org.test.One")
            task.cancel()
            proceed.set()

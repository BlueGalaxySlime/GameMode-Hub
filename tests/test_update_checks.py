"""No network at idle, daily caching, dates, manual refresh and restart."""
import tempfile
import threading
import time
import unittest
from pathlib import Path

from update_checks import UpdateChecks


class UpdateChecksTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.t = [1720000000.0]
        self.calls = []
        self.finished = threading.Event()

        def fake():
            self.calls.append(1)
            self.finished.set()
            return {"apps": [{"id": "org.mozilla.firefox", "updateable": True}], "error": ""}

        self.path = Path(self.temp.name) / "update_checks.json"
        self.checker = UpdateChecks({"flatpak": fake}, self.path, clock=lambda: self.t[0])

    def await_status(self, state):
        for _ in range(150):
            if self.checker.status()["state"] == state:
                return
            time.sleep(0.01)
        self.fail("State was not " + state)

    def test_check_once_daily_and_persist_result(self):
        self.assertEqual(self.calls, [])
        self.assertEqual(self.checker.status()["state"], "never")
        self.checker.request()
        self.assertTrue(self.finished.wait(2))
        self.await_status("ready")
        self.assertEqual(self.checker.status()["count"], 1)
        self.assertEqual(self.checker.status()["checked_at"], self.t[0])
        self.checker.request()
        self.assertEqual(len(self.calls), 1)
        restored = UpdateChecks(self.checker._providers, self.path, clock=lambda: self.t[0])
        self.assertEqual(restored.status()["state"], "ready")
        self.assertEqual(restored.status()["count"], 1)
        self.t[0] += 86401
        restored.request()
        for _ in range(150):
            if len(self.calls) > 1:
                break
            time.sleep(0.01)
        self.assertEqual(len(self.calls), 2)
        # The second check writes its cache asynchronously; wait before deleting
        # the TemporaryDirectory to avoid a cleanup race on GitHub Actions.
        for _ in range(150):
            if restored.status()["state"] == "ready":
                break
            time.sleep(0.01)
        self.assertEqual(restored.status()["state"], "ready")

    def test_manual_force_and_post_update_invalidation(self):
        self.checker.request()
        self.assertTrue(self.finished.wait(2))
        self.await_status("ready")
        self.finished.clear()
        self.checker.request(force=True)
        self.assertTrue(self.finished.wait(2))
        self.await_status("ready")
        self.assertEqual(len(self.calls), 2)
        self.checker.invalidate()
        self.assertEqual(self.checker.status()["state"], "never")
        self.assertTrue(self.checker.status()["stale"])
        self.assertEqual(len(self.calls), 2)  # no immediate check on invalidate

    def test_error_retry_backoff(self):
        invalid = UpdateChecks({"flatpak": lambda: {"apps": [], "error": "brak sieci"}},
                               Path(self.temp.name) / "errors.json", clock=lambda: self.t[0])
        invalid.request()
        for _ in range(150):
            if invalid.status()["state"] == "error":
                break
            time.sleep(0.01)
        self.assertEqual(invalid.status()["error"], "brak sieci")
        self.assertFalse(invalid.status()["stale"])
        self.t[0] += 1801
        self.assertTrue(invalid.status()["stale"])

    def test_reject_unregistered_source(self):
        with self.assertRaises(ValueError):
            self.checker.request("unknown")

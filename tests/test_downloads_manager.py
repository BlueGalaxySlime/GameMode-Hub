"""Queue, history and restart behavior of independent Downloads module."""
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from downloads_manager import DownloadManager


class FakeTask:
    def __init__(self):
        self.started = []
        self.cancelled = False
        self.state = "idle"

    def start(self, target=None):
        self.started.append(target)
        self.state = "running"
        return self.status()

    def status(self):
        return {"state": self.state, "message": self.state, "elapsed": 1}

    def cancel(self):
        self.cancelled = True
        self.state = "cancelled"
        return self.status()


class DownloadManagerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "downloads.json"
        self.task = FakeTask()
        self.nonroot = patch("downloads_manager.os.geteuid", return_value=1000)
        self.nonroot.start()
        self.addCleanup(self.nonroot.stop)
        self.manager = DownloadManager(self.task, self.path)
        self.addCleanup(self.manager.shutdown)

    def wait_for(self, state):
        for _ in range(60):
            if self.manager.list()["jobs"][0]["state"] == state:
                return
            time.sleep(0.02)
        self.fail("Timeout waiting for " + state)

    def test_ui_can_close_without_stopping_background_task(self):
        job = self.manager.enqueue_flatpak("com.microsoft.Edge")
        self.wait_for("running")
        self.assertEqual(self.task.started, ["com.microsoft.Edge"])
        self.assertEqual(self.manager.enqueue_flatpak("com.microsoft.Edge")["id"], job["id"])
        self.assertEqual(self.manager.list()["active"], 1)
        self.task.state = "success"
        self.wait_for("success")
        self.assertEqual(self.manager.list()["active"], 0)
        reopened = DownloadManager(FakeTask(), self.path)
        self.assertEqual(reopened.list()["jobs"][0]["state"], "success")

    def test_queue_runs_one_task_at_a_time(self):
        a = self.manager.enqueue_flatpak("org.test.One")
        self.wait_for("running")
        b = self.manager.enqueue_flatpak("org.test.Two")
        self.assertNotEqual(a["id"], b["id"])
        self.assertEqual(self.task.started, ["org.test.One"])
        self.manager.cancel(b["id"])
        self.assertEqual(self.manager.list()["jobs"][0]["state"], "cancelled")
        self.task.state = "success"
        self.wait_for("success")
        self.assertEqual(self.task.started, ["org.test.One"])

    def test_restart_marks_active_interrupted_no_auto_retry(self):
        self.path.write_text('{"version":1,"next_id":7,"jobs":['
                             '{"id":7,"target":"","state":"running","elapsed":90,"message":"x"}]}',
                             encoding="utf-8")
        new = DownloadManager(FakeTask(), self.path)
        self.assertEqual(new.list()["jobs"][0]["state"], "interrupted")
        self.assertEqual(new.list()["active"], 0)

    def test_invalid_and_root_requests_rejected(self):
        with self.assertRaises(ValueError):
            self.manager.enqueue_flatpak("$(unsafe)")
        with patch("downloads_manager.os.geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                self.manager.enqueue_flatpak()

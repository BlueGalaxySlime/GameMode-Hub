import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError

from backend.library.protondb_badges import ProtonDBBadgeCache, validate_app_id


class ProtonDBTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "ratings.json"
        self.clock = [1720000000.0]
        self.calls = []
        def fetch(app_id):
            self.calls.append(app_id)
            return {"tier": "gold", "reports": 42}
        self.cache = ProtonDBBadgeCache(self.path, fetch, lambda: self.clock[0])

    def test_lazy_fetch_daily_cache_and_persist(self):
        self.assertEqual(self.calls, [])
        result = self.cache.lookup("620")
        self.assertEqual(result["tier"], "gold")
        self.assertEqual(result["reports"], 42)
        self.assertFalse(result["cached"])
        self.assertEqual(self.cache.lookup(620)["cached"], True)
        self.assertEqual(len(self.calls), 1)
        restored = ProtonDBBadgeCache(self.path, self.cache._fetch, lambda: self.clock[0])
        self.assertTrue(restored.lookup("620")["cached"])
        self.clock[0] += 86401
        self.assertFalse(restored.lookup("620")["cached"])
        self.assertEqual(len(self.calls), 2)

    def test_force_and_bounded_cache(self):
        self.cache.lookup("620", force=True)
        self.cache.lookup("620", force=True)
        self.assertEqual(self.calls, ["620", "620"])
        for i in range(1, 88):
            self.cache.lookup(str(i), force=True)
        self.assertLessEqual(len(self.cache._entries), 80)

    def test_appid_validation(self):
        for bad in ("0", "-10", "1/../../secret", "hello", "99999999999", "", 0, True, None):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                validate_app_id(bad)
        self.assertEqual(validate_app_id(620), "620")

    def test_failure_has_short_retry(self):
        def failed(_):
            raise OSError("offline")
        bad = ProtonDBBadgeCache(self.path, failed, lambda: self.clock[0])
        self.assertEqual(bad.lookup("70")["tier"], "error")
        self.assertTrue(bad.lookup("70")["cached"])
        self.clock[0] += 1801
        self.assertFalse(bad.lookup("70")["cached"])

    def test_404_is_cached_as_missing_report(self):
        def not_found(_):
            raise HTTPError("url", 404, "not found", {}, None)
        bad = ProtonDBBadgeCache(self.path, not_found, lambda: self.clock[0])
        self.assertEqual(bad.lookup("70")["tier"], "unrated")

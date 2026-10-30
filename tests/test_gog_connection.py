"""GOG store link tests. Fixtures never use a user's real credentials or network."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from backend.stores import gog_unifideck as gog


class FakeAESGCM:
    def __init__(self, key):
        assert len(key) == 32

    def decrypt(self, nonce, payload, aad):
        assert len(nonce) == 12
        assert aad is None
        if payload == b"INVALID":
            raise ValueError("Invalid test ciphertext")
        return json.dumps({
            "access_token": "test-access-only",
            "refresh_token": "test-refresh-only",
            "username": "Example",
        }).encode("utf-8")


class GOGLinkTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.folder = Path(self.tempdir.name)
        self.source = self.folder / "gog_token.json"
        self.link = self.folder / "hub" / "store_links.json"
        source_patch = patch.object(gog, "_SOURCE", self.source)
        link_patch = patch.object(gog, "_LINK", self.link)
        aes_patch = patch.object(gog, "_aesgcm", return_value=FakeAESGCM)
        source_patch.start()
        link_patch.start()
        aes_patch.start()
        self.addCleanup(source_patch.stop)
        self.addCleanup(link_patch.stop)
        self.addCleanup(aes_patch.stop)

    def write_session(self, content=b"UFD1" + b"n" * 12 + b"MOCK-CIPHERTEXT!", mode=0o600):
        self.source.write_bytes(content)
        self.source.chmod(mode)

    def test_no_implicit_import_or_decryption_in_status(self):
        self.assertEqual(gog.status()["state"], "missing")
        self.write_session()
        with patch.object(gog, "_credentials", side_effect=AssertionError("must not decrypt")):
            self.assertEqual(gog.status()["state"], "available")
        self.assertFalse(self.link.exists())

    def test_explicit_link_is_non_secret_and_unlink_preserves_unifideck(self):
        self.write_session()
        before = self.source.read_bytes()
        result = gog.link()
        self.assertTrue(result["ok"])
        self.assertEqual(gog.status()["state"], "linked")
        self.assertEqual(json.loads(self.link.read_text()), {"gog": "unifideck-readonly"})
        self.assertEqual(self.link.stat().st_mode & 0o777, 0o600)
        self.assertNotIn("test-access", self.link.read_text())
        self.assertNotIn("test-refresh", self.link.read_text())
        self.assertTrue(gog.unlink()["ok"])
        self.assertEqual(self.source.read_bytes(), before)
        self.assertEqual(gog.status()["state"], "available")

    def test_missing_legacy_and_world_readable_sources_fail_closed(self):
        self.assertEqual(gog.link()["code"], "missing")
        self.write_session(b'{"access_token": "plaintext"}')
        self.assertEqual(gog.status()["state"], "unusable")
        self.assertEqual(gog.link()["code"], "unusable")
        self.write_session(mode=0o644)
        self.assertEqual(gog.status()["state"], "unusable")
        self.assertEqual(gog.link()["code"], "unusable")
        self.assertFalse(self.link.exists())

    def test_symlink_source_is_rejected(self):
        other = self.folder / "target"
        other.write_bytes(b"UFD1" + b"n" * 12 + b"MOCK-CIPHERTEXT!")
        other.chmod(0o600)
        self.source.symlink_to(other)
        self.assertEqual(gog.status()["state"], "unusable")
        self.assertFalse(gog.link()["ok"])

    def test_library_requires_consent_and_never_returns_credentials(self):
        self.write_session()
        self.assertEqual(gog.library()["code"], "not_linked")
        self.assertTrue(gog.link()["ok"])
        def response(token, page):
            self.assertEqual(token, "test-access-only")
            self.assertEqual(page, 1)
            return {"products": [{"id": 42, "title": "Sample GOG Game"}], "totalPages": 1}
        with patch.object(gog, "_request_page", side_effect=response):
            answer = gog.library()
        self.assertEqual(answer, {"ok": True,
                                  "games": [{"store": "gog", "id": "42", "title": "Sample GOG Game"}],
                                  "partial": False})
        self.assertNotIn("test-access", str(answer))
        self.assertNotIn("test-refresh", str(answer))

    def test_expired_auth_does_not_become_empty_library(self):
        self.write_session()
        self.assertTrue(gog.link()["ok"])
        with patch.object(gog, "_request_page", side_effect=HTTPError(
            "https://embed.gog.com", 401, "Unauthorized", {}, None
        )):
            answer = gog.library()
        self.assertFalse(answer["ok"])
        self.assertEqual(answer["code"], "auth_expired")
        self.assertEqual(answer["games"], [])

    def test_crypto_dependency_failure_does_not_persist_link(self):
        self.write_session()
        with patch.object(gog, "_aesgcm", side_effect=RuntimeError("crypto_unavailable")):
            result = gog.link()
        self.assertEqual(result["code"], "crypto_unavailable")
        self.assertFalse(self.link.exists())


if __name__ == "__main__":
    unittest.main()

"""Independent GOG auth security and library tests, without network or credentials."""
import json
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from backend.stores import gog_native as gog


class GOGNativeTests(unittest.TestCase):
    def setUp(self):
        gog._SESSION = None
        gog._PENDING = None
        self.addCleanup(self._reset)

    @staticmethod
    def _reset():
        gog._SESSION = None
        gog._PENDING = None

    def test_never_uses_unifideck_for_login(self):
        result = gog.begin("memory")
        self.assertTrue(result["ok"])
        self.assertIn("https://auth.gog.com/auth?", result["url"])
        self.assertIn("state=", result["url"])
        self.assertNotIn("unifideck", result["url"].lower())
        self.assertIsNone(gog._SESSION)

    def test_full_verified_gog_callback_logs_in_with_only_tokens_in_memory(self):
        url = gog.begin("memory")
        self.assertTrue(url["ok"])
        callback = ("https://embed.gog.com/on_login_success?origin=client"
                    "&code=EXAMPLE_GOG_AUTH_CODE_123456")
        with patch.object(gog, "_exchange", return_value={
            "access_token": "private-access", "refresh_token": "private-refresh",
            "expires_in": 3600
        }) as exchange:
            result = gog.complete(callback)
        self.assertEqual(result, {"ok": True, "storage": "memory"})
        self.assertTrue(gog.status()["connected"])
        self.assertEqual(gog.status()["storage"], "memory")
        self.assertNotIn("private-access", str(result))
        self.assertNotIn("private-refresh", str(result))
        exchange.assert_called_once_with("authorization_code", "EXAMPLE_GOG_AUTH_CODE_123456")
        self.assertFalse(gog.complete(callback)["ok"])  # replay rejected

    def test_callback_origin_and_state_validation(self):
        for callback in (
            "https://attacker.tld/on_login_success?code=EXAMPLE_GOG_AUTH_CODE_123456",
            "http://embed.gog.com/on_login_success?code=EXAMPLE_GOG_AUTH_CODE_123456",
            "https://embed.gog.com.evil.com/on_login_success?code=EXAMPLE_GOG_AUTH_CODE_123456",
            "https://embed.gog.com/on_login_success?code=EXAMPLE_GOG_AUTH_CODE_123456&state=wrong",
            "https://embed.gog.com/on_login_success?code=EXAMPLE_GOG_AUTH_CODE_123456&code=EXAMPLE_GOG_AUTH_CODE_123456",
            "https://embed.gog.com/on_login_success?code=short",
        ):
            gog.begin("memory")
            with patch.object(gog, "_exchange", side_effect=AssertionError("must not exchange")):
                self.assertEqual(gog.complete(callback)["code"], "bad_callback")
        self.assertFalse(gog.status()["connected"])

    def test_expired_challenge_fails_without_token_exchange(self):
        gog.begin("memory")
        gog._PENDING["started"] -= 601
        with patch.object(gog, "_exchange", side_effect=AssertionError("expired")):
            self.assertEqual(gog.complete(
                "https://embed.gog.com/on_login_success?origin=client"
                "&code=EXAMPLE_GOG_AUTH_CODE_123456")["code"], "login_expired")

    def test_keyring_opt_in_checks_vault_before_login(self):
        with patch.object(gog, "_vault_collection", side_effect=RuntimeError("vault_locked")):
            result = gog.begin("keyring")
        self.assertEqual(result["code"], "vault_locked")
        self.assertIsNone(gog._PENDING)
        self.assertFalse(gog.status()["connected"])

    def test_session_library_with_no_unifideck(self):
        gog._SESSION = {"access_token": "private-access", "refresh_token": "private-refresh",
                        "expires_at": time.time() + 3600, "saved": False}
        expected = {"ok": True, "games": [{"store": "gog", "id": "123", "title": "Game"}],
                    "partial": False}
        with patch.object(gog, "_fetch_library", return_value=expected) as fetch:
            self.assertEqual(gog.library(), expected)
        fetch.assert_called_once()
        self.assertEqual(fetch.call_args.args[0]["access_token"], "private-access")
        self.assertEqual(gog.logout(), {"ok": True})
        self.assertEqual(gog.library()["code"], "not_logged_in")

    def test_expired_token_refreshes_instead_of_faking_empty_library(self):
        gog._SESSION = {"access_token": "expired", "refresh_token": "refresh",
                        "expires_at": time.time() - 10, "saved": False}
        expected = {"ok": True, "games": [], "partial": False}
        with patch.object(gog, "_exchange", return_value={
            "access_token": "new-access", "refresh_token": "new-refresh",
            "expires_in": 3600
        }) as exchange, patch.object(gog, "_fetch_library", return_value=expected):
            self.assertEqual(gog.library(), expected)
        exchange.assert_called_once_with("refresh_token", "refresh")
        self.assertEqual(gog._SESSION["access_token"], "new-access")

    def test_keyring_save_and_logout_are_opt_in(self):
        gog.begin("memory")
        callback = ("https://embed.gog.com/on_login_success?origin=client"
                    "&code=EXAMPLE_GOG_AUTH_CODE_123456")
        with patch.object(gog, "_exchange", return_value={
            "access_token": "secret", "refresh_token": "secret2"
        }), patch.object(gog, "_vault_save") as vault:
            result = gog.complete(callback)
        self.assertTrue(result["ok"])
        vault.assert_not_called()


if __name__ == "__main__":
    unittest.main()

"""Terminal service smoke tests. No Steam, Decky, or external dependencies."""
import base64
import asyncio
import os
import time
import unittest
from unittest.mock import patch

from terminal_core.service import (
    MAX_BUFFER, TerminalService, decode_input, validate_dimensions
)


class TerminalBackendHandshakeTests(unittest.TestCase):
    def test_handshake_is_available_without_starting_pty(self):
        from main import Plugin
        plugin = Plugin()
        self.assertIsNone(plugin._terminal)
        info = asyncio.run(plugin.terminal_ping())
        self.assertTrue(info["ok"])
        self.assertEqual(info["protocol"], 2)
        self.assertIsNone(plugin._terminal)

    def test_no_terminal_process_can_start_in_safe_mode(self):
        from main import Plugin
        plugin = Plugin()
        with self.assertRaisesRegex(RuntimeError, "tymczasowo"):
            asyncio.run(plugin.terminal_start(80, 24))
        self.assertIsNone(plugin._terminal)


class TerminalValidationTests(unittest.TestCase):
    def test_reject_invalid_size(self):
        for cols, rows in ((0, 24), (80, 0), (501, 24), (80, 201),
                           ("80", 24), (True, 24), (80, 24.5)):
            with self.subTest(cols=cols, rows=rows), self.assertRaises(ValueError):
                validate_dimensions(cols, rows)

    def test_reject_invalid_input(self):
        for value in (None, {}, "!!", "A" * 9000,
                      base64.b64encode(b"x" * 5000).decode()):
            with self.subTest(value=repr(value)[:30]), self.assertRaises(ValueError):
                decode_input(value)

    def test_unicode_input_roundtrip(self):
        payload = base64.b64encode("zażółć".encode()).decode()
        self.assertEqual(decode_input(payload), "zażółć".encode())

    def test_root_never_starts_a_shell(self):
        service = TerminalService()
        with patch("terminal_core.service.os.geteuid", return_value=0):
            with self.assertRaises(PermissionError):
                service.start()

    def test_unknown_session_fails_closed(self):
        service = TerminalService()
        with self.assertRaises(ValueError):
            service.read("invalid")
        with self.assertRaises(ValueError):
            service.write("invalid", "YQ==")
        service.close("invalid")  # Closing twice or a stale ID is harmless.


@unittest.skipIf(os.geteuid() == 0, "PTY integration test requires a non-root user")
class TerminalIntegrationTests(unittest.TestCase):
    def test_real_pty_echo_and_cleanup(self):
        service = TerminalService()
        session_id = service.start(80, 24)["id"]
        try:
            service.write(session_id, base64.b64encode(b"printf 'STEAMHUB_PTY_OK\\n'\n").decode())
            output = bytearray()
            for _ in range(80):
                state = service.read(session_id)
                output.extend(base64.b64decode(state["data"]))
                if b"STEAMHUB_PTY_OK" in output:
                    break
                time.sleep(0.05)
            self.assertIn(b"STEAMHUB_PTY_OK", output)
            self.assertTrue(state["running"])
            service.resize(session_id, 100, 30)
        finally:
            service.close_all()
            service.close(session_id)


if __name__ == "__main__":
    unittest.main()

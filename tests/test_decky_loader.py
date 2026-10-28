"""Regression: Decky loads a plugin by file path, not by its package name.

In a real Decky sandbox, Python's sys.path normally contains 'py_modules'
but not the plugin directory. Tests run from repo root can accidentally hide
a missing sys.path setup; use -I and a different current working directory.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent

# Pass the plugin entry path explicitly, like Decky's SandboxedPlugin.initialize.
SCRIPT = r"""
import asyncio
import importlib.util
import json
from pathlib import Path
import sys

entry = Path(sys.argv[1]).resolve()
assert str(entry.parent) not in sys.path, "Test must start without plugin import path"
spec = importlib.util.spec_from_file_location("_", entry)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
instance = module.Plugin()
assert instance._terminal is None, "PTY must not start while loading plugin"
response = asyncio.run(instance.terminal_ping())
assert response["ok"] is True and response["protocol"] == 2
options = asyncio.run(instance.get_hub_preferences())
assert isinstance(options["autoKeyboard"], bool)
assert isinstance(options["saveSession"], bool)
# A packaged module from the same directory must also remain importable.
import terminal_core
print(json.dumps({"version": response["version"], "protocol": response["protocol"]}))
"""


class DeckySandboxTests(unittest.TestCase):
    def test_backend_loads_outside_project_root(self):
        with tempfile.TemporaryDirectory(prefix="steamhub-decky-test-") as outside:
            environment = os.environ.copy()
            environment.pop("PYTHONPATH", None)
            process = subprocess.run(
                [sys.executable, "-I", "-c", SCRIPT, str(ROOT / "main.py")],
                cwd=outside,
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=15,
                check=False,
            )
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(json.loads(process.stdout)["protocol"], 2)


if __name__ == "__main__":
    unittest.main()

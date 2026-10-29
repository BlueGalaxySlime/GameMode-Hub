"""The three states add no background sampler."""
import unittest
from backend.core import runtime_state


class RuntimeStateTests(unittest.TestCase):
    def tearDown(self):
        runtime_state.set_hub_ui_open(False)

    def test_three_states(self):
        runtime_state.set_hub_ui_open(False)
        self.assertEqual(runtime_state.get_runtime_state(0), "sleeping")
        self.assertEqual(runtime_state.get_runtime_state(1), "background")
        runtime_state.set_hub_ui_open(True)
        self.assertEqual(runtime_state.get_runtime_state(0), "active")
        self.assertEqual(runtime_state.get_runtime_state(1), "active")
        with self.assertRaises(ValueError):
            runtime_state.set_hub_ui_open("yes")

    def test_measurements_are_on_demand(self):
        snapshot = runtime_state.diagnostics()
        self.assertIn("backend_cpu_percent", snapshot)
        self.assertIn("backend_rss_mib", snapshot)

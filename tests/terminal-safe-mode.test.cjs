const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const adapter = fs.readFileSync("src/hub/DeckyTerminalAdapter.tsx", "utf8");
const backend = fs.readFileSync("main.py", "utf8");
const packageScript = fs.readFileSync("scripts/package.py", "utf8");

test("terminal is mounted only after an explicit user action or a live session", () => {
  assert.match(adapter, /TerminalView/);
  assert.match(adapter, /activated\.includes\(active\)/);
  assert.match(adapter, /getSlot\(active\)\.phase === "connected"/);
  assert.match(adapter, /onClick=\{\(\) => setActivated/);
  assert.match(adapter, /Uruchom terminal/);
  assert.match(adapter, /HubTextInput/);
  assert.match(adapter, /onOptionsButton/);
  assert.match(adapter, /onSecondaryButton/);
  assert.match(adapter, /onButtonDown/);
  assert.match(adapter, /nextTerminalSession/);
});

test("backend starts PTY only on demand, off the Decky event loop", () => {
  const start = backend.split("async def terminal_start(", 2)[1].split("async def terminal_read(", 1)[0];
  assert.match(start, /asyncio\.to_thread\(service\.start/);
  const ping = backend.split("async def terminal_ping(", 2)[1].split("def _terminal_service(", 1)[0];
  assert.doesNotMatch(ping, /TerminalService\(|\.start\(/);
  assert.match(backend, /asyncio\.to_thread\(self\._terminal\.close_all\)/);
  assert.match(packageScript, /"terminal_core"/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const adapter = fs.readFileSync("src/hub/DeckyTerminalAdapter.tsx", "utf8");
const backend = fs.readFileSync("main.py", "utf8");

test("temporary safe mode does not mount xterm or call backend methods", () => {
  assert.doesNotMatch(adapter, /\bTerminalView\b|\bcallable\s*<|\bterminal_start\b|\bautoStart\b/);
  assert.match(adapter, /tryb bezpieczny/i);
});
test("backend fails closed to cached old terminal frontends", () => {
  assert.match(backend, /async def terminal_start\(/);
  const start = backend.split("async def terminal_start(", 2)[1].split("async def terminal_read(", 1)[0];
  assert.match(start, /raise RuntimeError/);
  assert.doesNotMatch(start, /\.start\(/);
});

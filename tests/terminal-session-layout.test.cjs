const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const source = fs.readFileSync("src/modules/terminal/sessionNavigation.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);

test("session navigation wraps left and right without losing the active session", () => {
  const { nextTerminalSession, TERMINAL_SESSIONS } = moduleExports;
  assert.deepEqual(TERMINAL_SESSIONS, [0, 1, 2]);
  assert.equal(nextTerminalSession(0, -1), 2);
  assert.equal(nextTerminalSession(2, 1), 0);
  assert.equal(nextTerminalSession(1, -1), 0);
  assert.equal(nextTerminalSession(1, 1), 2);
  assert.equal(nextTerminalSession(99, 1), 1);
});

test("safe UI shares Files/Desktop navigation without spawning a shell", () => {
  const code = fs.readFileSync("src/hub/DeckyTerminalAdapter.tsx", "utf8");
  assert.match(code, /aria-label="Stan terminala"/);
  assert.match(code, /flow-children="row"/);
  assert.match(code, /aria-label="Sesje terminala/);
  assert.match(code, /onOptionsButton/);
  assert.match(code, /onSecondaryButton/);
  assert.match(code, /onButtonDown/);
  assert.doesNotMatch(code, /\bTerminalView\b|\bcallable\s*<|\bterminal_start\b/);
});

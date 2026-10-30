const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const source = fs.readFileSync("src/modules/terminal/sessionNavigation.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);

test("tabs start with one slot, + opens up to three without starting PTYs", () => {
  const { INITIAL_TERMINAL_TABS, addTerminalSession } = moduleExports;
  assert.deepEqual(INITIAL_TERMINAL_TABS, { open: [0], selected: 0 });
  const second = addTerminalSession(INITIAL_TERMINAL_TABS);
  assert.deepEqual(second, { open: [0, 1], selected: 1 });
  const third = addTerminalSession(second);
  assert.deepEqual(third, { open: [0, 1, 2], selected: 2 });
  assert.deepEqual(addTerminalSession(third), third);
});

test("closing a tab preserves stable IDs and remaining selection", () => {
  const { addTerminalSession, closeTerminalSession, selectTerminalSession,
    nextTerminalSession, INITIAL_TERMINAL_TABS } = moduleExports;
  const three = addTerminalSession(addTerminalSession(INITIAL_TERMINAL_TABS));
  const middle = closeTerminalSession(three, 1);
  assert.deepEqual(middle, { open: [0, 2], selected: 2 });
  assert.equal(nextTerminalSession(2, 1, middle.open), 0);
  assert.equal(nextTerminalSession(0, -1, middle.open), 2);
  assert.deepEqual(selectTerminalSession(middle, 1), middle);
  assert.deepEqual(selectTerminalSession(middle, 0), { open: [0, 2], selected: 0 });
  const empty = closeTerminalSession(closeTerminalSession(middle, 2), 0);
  assert.deepEqual(empty, { open: [], selected: null });
  assert.equal(nextTerminalSession(null, 1, empty.open), null);
  assert.deepEqual(addTerminalSession(empty), { open: [0], selected: 0 });
});

test("terminal uses the same content layout as Files and Desktop, not custom route padding", () => {
  const code = fs.readFileSync("src/hub/DeckyTerminalAdapter.tsx", "utf8");
  const hub = fs.readFileSync("src/hub/HubPage.tsx", "utf8");
  assert.match(code, /aria-label="Stan terminala"/);
  assert.match(code, /flow-children="row"/);
  assert.match(code, /aria-label="Sesje terminala/);
  assert.match(code, /data-terminal-add/);
  assert.match(code, /Zamknij zakładkę/);
  assert.match(code, /height: "min\(54vh, 540px\)"/);
  assert.match(code, /onOptionsButton/);
  assert.match(code, /onSecondaryButton/);
  assert.match(code, /onButtonDown/);
  assert.match(hub, /title: "Terminal"[\s\S]*?content: <DeckyTerminalPage/);
  assert.doesNotMatch(hub, /title: "Terminal"[\s\S]*?hideTitle: true, padding: "none"/);
  assert.match(code, /TerminalView/);
  assert.match(code, /Uruchom terminal/);
  assert.match(code, /activated\\.includes\\(active\\)/);
  assert.match(code, /HubTextInput/);
});

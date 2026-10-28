"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const ui = fs.readFileSync("src/hub/FileManagerPage.tsx", "utf8");
const compiled = ts.transpileModule(fs.readFileSync("src/core/filePath.ts","utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { breadcrumbs } = context.exports;

test("Y opens the native overlay menu for the focused file", () => {
  assert.ok(ui.includes("showContextMenu("));
  assert.ok(ui.includes('onOptionsActionDescription="Opcje"'));
  assert.ok(ui.includes("onOptionsButton={event => openFileMenu(entry, event.currentTarget ?? window)}"));
  assert.ok(ui.includes("<Menu label={entry.name}"));
  assert.ok(ui.includes("<MenuItem onSelected={() => {"));
  assert.ok(ui.includes('clipboardAction(entry, "copy")'));
  assert.ok(ui.includes('clipboardAction(entry, "move")'));
  assert.ok(!ui.includes("onSecondaryButton="));
});
test("native overlay sort menu, no inline expanded list or extra sorting arrows", () => {
  assert.ok(ui.includes('openSortMenu(event.currentTarget ?? window)'));
  assert.ok(ui.includes('<Menu label="Sortuj"'));
  assert.ok(ui.includes('selected={sortMode === option.data}'));
  for(const name of ["Nazwa A–Z", "Nazwa Z–A", "Typ A–Z", "Typ Z–A", "Rozmiar ↑", "Data ↓"])
    assert.ok(ui.includes(name));
  assert.ok(!ui.includes("<Dropdown"));
});
test("selecting a file never expands action buttons", () => {
  assert.ok(ui.includes('if (entry.directory) void load(entry.path, hidden)'));
  assert.ok(ui.includes("setSelected(entry)"));
  assert.ok(!ui.includes(">Zmień</DialogButton>"));
  assert.ok(!ui.includes(">Kopiuj</DialogButton>"));
  assert.ok(!ui.includes(">Przenieś</DialogButton>"));
  assert.ok(!ui.includes(">⋯</DialogButton>"));
  assert.ok(!ui.includes(">Zamknij</DialogButton>"));
});
test("no redundant command UI; path tags are constrained", () => {
  assert.ok(!ui.includes(">Przejdź</DialogButton>"));
  assert.ok(!ui.includes(">Odśwież</DialogButton>"));
  assert.ok(ui.includes('event.key === "Enter"'));
  const path = breadcrumbs("/home/deck/Downloads/sub", [{ name: "Dom", path: "/home/deck" }]);
  assert.deepEqual(Array.from(path, x => x.path), ["/home/deck","/home/deck/Downloads","/home/deck/Downloads/sub"]);
  assert.equal(breadcrumbs("/etc", [{name:"Dom",path:"/home/deck"}]).length, 0);
});

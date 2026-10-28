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

test("horizontal focus matches physical left/right controls", () => {
  assert.ok(ui.includes('flow-children="right"'));
  assert.ok(ui.includes('flow-children="down"'));
  assert.ok(ui.includes("NavEntryPositionPreferences.MAINTAIN_X"));
  assert.ok(ui.includes("NavEntryPositionPreferences.MAINTAIN_Y"));
});
test("split is limited to the directory browser below the toolbar", () => {
  const split = ui.indexOf('Only this directory-browser area is split');
  const toolbar = ui.indexOf('Same compact toolbar as SteamOS settings');
  const address = ui.indexOf('aria-label="Ścieżka katalogu"');
  assert.ok(address >= 0 && toolbar > address && split > toolbar);
  assert.ok(ui.includes("const splitTree = options.splitFileTree"));
  assert.ok(ui.includes('splitTree ? "row" : "column"'));
  assert.ok(ui.includes("page.items.filter(entry => entry.directory)"));
  assert.ok(ui.includes("page.items.filter(entry => !entry.directory)"));
  assert.ok(ui.includes('maxHeight: "56vh"'));
});
test("file view session survives tab switches without reinitializing the path", () => {
  for(const key of ["files.page", "files.pathDraft", "files.hidden", "files.sortMode",
      "files.selected", "files.clipboard", "files.action", "files.name"])
    assert.ok(ui.includes(key), key);
  assert.ok(ui.includes('if (!page) void load(null, hidden, 0, sortBy, descending);'));
});

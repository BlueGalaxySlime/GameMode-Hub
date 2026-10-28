"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

const ui = fs.readFileSync("src/hub/FileManagerPage.tsx", "utf8");
const updater = fs.readFileSync("src/hub/UpdaterPage.tsx", "utf8");
const hubOptions = fs.readFileSync("src/hub/HubOptionsPage.tsx", "utf8");
const compiled = ts.transpileModule(fs.readFileSync("src/core/filePath.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { breadcrumbs } = context.exports;

test("Y on the focused file or address opens native SteamOS context menu", () => {
  assert.ok(ui.includes("showContextMenu("));
  assert.ok(ui.includes('onOptionsActionDescription="Opcje plików"'));
  assert.ok(ui.includes("openBrowserMenu(event.currentTarget ?? window)"));
  assert.ok(ui.includes('onOptionsActionDescription="Opcje"'));
  assert.ok(ui.includes("onOptionsButton={event => openFileMenu(entry, event.currentTarget ?? window, pane)}"));
  assert.ok(ui.includes("<Menu label={entry.name}"));
  assert.ok(ui.includes('clipboardAction(entry, "copy")'));
  assert.ok(ui.includes('clipboardAction(entry, "move")'));
  assert.ok(!ui.includes("onSecondaryButton="));
});

test("file options are in native right-hand submenus, not inline controls", () => {
  assert.ok(ui.includes('<Menu label="Opcje plików"'));
  for (const label of ["Pokaż ukryte", "Podziel ekran", "Sortowanie"]) {
    assert.ok(ui.includes('<MenuGroup label="' + label + '"'), label);
  }
  assert.ok(ui.includes("Nowy folder..."));
  assert.ok(ui.includes("changeHidden(show: boolean)"));
  assert.ok(ui.includes("changeSplitTree(enabled: boolean)"));
  assert.ok(ui.includes("selected={sortMode === option.data}"));
  for (const name of ["Nazwa A–Z", "Nazwa Z–A", "Typ A–Z", "Typ Z–A", "Rozmiar ↑", "Data ↓"]) {
    assert.ok(ui.includes(name));
  }
  assert.ok(!ui.includes("<Dropdown"));
  assert.ok(!ui.includes(">Zmień</DialogButton>"));
  assert.ok(!ui.includes(">Kopiuj</DialogButton>"));
  assert.ok(!ui.includes(">Przenieś</DialogButton>"));
});

test("path can be edited with A, while status strip is read only", () => {
  assert.ok(ui.includes('onOKActionDescription="Edytuj ścieżkę"'));
  assert.ok(ui.includes("onClick={() => setEditingPath(true)}"));
  assert.ok(ui.includes('aria-label="Edytuj ścieżkę katalogu"'));
  assert.ok(ui.includes('event.key === "Enter"'));
  assert.ok(ui.includes('event.key === "Escape"'));
  assert.ok(ui.includes('<HubTextInput value={pathDraft}'));
  assert.ok(!ui.includes('>Przejdź</DialogButton>'));
  assert.ok(ui.includes('onCancelActionDescription={editingPath ? "Zamknij edycję"'));
  assert.ok(ui.includes('aria-label="Stan przeglądarki plików"'));
  assert.ok(ui.includes("Sortowanie: {sortOptions.find("));
  assert.ok(ui.includes('Ukryte: {hidden ? "widoczne" : "niewidoczne"}'));
  assert.ok(!ui.includes(">Odśwież</DialogButton>"));
  const parts = breadcrumbs("/home/deck/Downloads/sub", [{name:"Dom",path:"/home/deck"}]);
  assert.deepEqual(Array.from(parts, x => x.path), ["/home/deck", "/home/deck/Downloads", "/home/deck/Downloads/sub"]);
  assert.equal(breadcrumbs("/etc", [{name:"Dom",path:"/home/deck"}]).length, 0);
});

test("controller navigation has explicit horizontal and vertical groups", () => {
  assert.ok(ui.includes('flow-children="row"'));
  assert.ok(ui.includes('flow-children="column"'));
  assert.ok(ui.includes("NavEntryPositionPreferences.MAINTAIN_X"));
  assert.ok(ui.includes("NavEntryPositionPreferences.MAINTAIN_Y"));
  assert.ok(ui.includes('flow-children={splitTree ? "row" : "column"}'));
});

test("split file browser uses two independent complete lists and one address bar", () => {
  const address = ui.indexOf('onOKActionDescription="Edytuj ścieżkę"');
  const status = ui.indexOf('aria-label="Stan przeglądarki plików"');
  const browser = ui.indexOf("Two complete file panels, one shared white address bar");
  assert.ok(address >= 0 && status > address && browser > status);
  assert.equal(ui.split('onOKActionDescription="Edytuj ścieżkę"').length - 1, 1);
  assert.ok(ui.includes("const splitTree = options.splitFileTree"));
  assert.ok(ui.includes('const [rightPage, setRightPage]'));
  assert.ok(ui.includes('flexDirection: splitTree ? "row" : "column"'));
  assert.ok(ui.includes('folder.items.map(entry =>'));
  assert.ok(ui.includes('onMouseEnter={() => activatePane(pane)}'));
  assert.ok(ui.includes('onGamepadFocus={() => activatePane(pane)}'));
  assert.ok(ui.includes('Podział: {splitTree ? "WŁ." : "WYŁ."}'));
  assert.ok(ui.includes('height: "min(54vh, 540px)"'));
  assert.ok(ui.includes('pane === "left" ? "files.treeScrollTop" : "files.listScrollTop"'));
  assert.ok(ui.includes("<ParentDirectoryRow parent={folder.parent}"));
  assert.ok(!ui.includes("page.items.filter(entry => !entry.directory)"));
});

test("file view session survives changing Hub tabs", () => {
  for (const key of ["files.page", "files.pathDraft", "files.editingPath", "files.hidden",
    "files.sortMode", "files.selected", "files.clipboard", "files.action", "files.name"]) {
    assert.ok(ui.includes(key), key);
  }
  assert.ok(ui.includes('if (!page) void load(null, hidden, 0, sortBy, descending, "left");'));
});

test("split option appears only in Files, not universal Hub options", () => {
  assert.ok(ui.includes('<MenuGroup label="Podziel ekran"'));
  assert.ok(!hubOptions.includes('label="Podział drzewa plików"'));
  assert.ok(!hubOptions.includes("splitFileTree"));
  assert.ok(hubOptions.includes('label="Zachowuj stan kart"'));
  assert.ok(hubOptions.includes('label="Automatycznie pokazuj klawiaturę"'));
  assert.ok(hubOptions.includes('update("autoKeyboard", value)'));
});

test("updater opens native channel/version menus without inline version list", () => {
  assert.ok(updater.includes("openChannelMenu(event.currentTarget ?? window)"));
  assert.ok(updater.includes("openVersionsMenu(event.currentTarget ?? window)"));
  assert.ok(updater.includes('<Menu label="Kanał aktualizacji"'));
  assert.ok(updater.includes('<Menu label="Wybierz wersję"'));
  assert.ok(updater.includes("selected={selected?.version === entry.version}"));
  assert.ok(updater.includes("confirmDowngrade"));
  assert.ok(!updater.includes('entries.map(entry =>\n            <DialogButton'));
});

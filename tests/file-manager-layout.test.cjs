"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript"),vm=require("node:vm");
const ui=fs.readFileSync("src/hub/FileManagerPage.tsx","utf8");
const compiled=ts.transpileModule(fs.readFileSync("src/core/filePath.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(compiled,context);const {breadcrumbs}=context.exports;
test("no extra navigation or close buttons",()=>{
  for(const word of [">Przejdź</DialogButton>",">Odśwież</DialogButton>",">Zamknij</DialogButton>",">⋯</DialogButton>"])
    assert.ok(!ui.includes(word));
  assert.ok(ui.includes('event.key === "Enter"'));
  assert.ok(ui.includes('void load(pathDraft, hidden)'));
});
test("breadcrumb tags stay within allowed roots",()=>{
  const parts=breadcrumbs("/home/deck/Downloads/sub",[{name:"Dom",path:"/home/deck"}]);
  assert.deepEqual(Array.from(parts,x=>x.path),["/home/deck","/home/deck/Downloads","/home/deck/Downloads/sub"]);
  assert.equal(breadcrumbs("/etc",[{name:"Dom",path:"/home/deck"}]).length,0);
});
test("one native sorting dropdown with combined direction and type",()=>{
  assert.ok(ui.includes("<Dropdown"));
  assert.ok(ui.includes('menuLabel="Sortuj"'));
  assert.ok(ui.includes('selectedOption={sortMode}'));
  for(const label of ["Nazwa A–Z","Nazwa Z–A","Typ A–Z","Typ Z–A","Rozmiar ↑","Data ↓"])
    assert.ok(ui.includes(label));
  assert.ok(!ui.includes("changeSort(sortBy, !descending)"));
});
test("file actions stay in the same row",()=>{
  assert.ok(ui.includes('onSecondaryActionDescription="Opcje"'));
  assert.ok(ui.includes('onSecondaryButton={() => {'));
  assert.ok(ui.includes('if (entry.directory) void load(entry.path, hidden)'));
  assert.ok(ui.includes('selected?.path === entry.path'));
  for(const text of [">Zmień</DialogButton>",">Kopiuj</DialogButton>",">Przenieś</DialogButton>"])
    assert.ok(ui.includes(text));
  assert.ok(!ui.includes("showContextMenu"));
});
test("Steam footer handles back and refresh without UI buttons",()=>{
  assert.ok(ui.includes("<Focusable"));
  assert.ok(ui.includes("onCancelActionDescription="));
  assert.ok(ui.includes("onOptionsButton="));
  assert.ok(ui.includes("setHidden(value)"));
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const ui = fs.readFileSync("src/hub/FileManagerPage.tsx","utf8");
const source = fs.readFileSync("src/core/filePath.ts","utf8");
const compiled = ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS
}}).outputText;
const context={exports:{}};
vm.runInNewContext(compiled,context);
const {breadcrumbs}=context.exports;

test("one page title, with no redundant Field headings",()=>{
  assert.ok(!ui.includes("DialogControlsSectionHeader"));
  assert.ok(!ui.includes('label="Bieżący katalog"'));
  assert.ok(!ui.includes('label="Lokalizacje"'));
  assert.ok(!ui.includes('label="Nawigacja"'));
  assert.ok(!ui.includes('>Wybierz</DialogButton>'));
});
test("path can be edited, opened, and navigated with clickable breadcrumbs",()=>{
  assert.ok(ui.includes("onChange={event => setPathDraft(event.target.value)}"));
  assert.ok(ui.includes('event.key === "Enter"'));
  assert.ok(ui.includes("void load(pathDraft, hidden)"));
  assert.ok(ui.includes("breadcrumbs(page.path, page.roots)"));
  const result=breadcrumbs("/home/deck/Downloads/abc",[{name:"Dom",path:"/home/deck"}]);
  assert.deepEqual(Array.from(result,x=>x.path),[
    "/home/deck","/home/deck/Downloads","/home/deck/Downloads/abc"]);
  assert.deepEqual(Array.from(result,x=>x.name),["Dom","Downloads","abc"]);
  assert.equal(breadcrumbs("/etc",[{name:"Dom",path:"/home/deck"}]).length,0);
  assert.equal(breadcrumbs("/home/deck2",[{name:"Dom",path:"/home/deck"}]).length,0);
});
test("compact full width list and sorting/hidden options stay accessible",()=>{
  assert.ok(ui.includes("flex: 1, minWidth: 0"));
  assert.ok(ui.includes('Sortuj: {sortLabels[sortBy]}'));
  assert.ok(ui.includes("changeSort(sortBy, !descending)"));
  assert.ok(ui.includes("setHidden(value)"));
  assert.ok(ui.includes('aria-label={"Opcje: " + entry.name}'));
});

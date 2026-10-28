"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(fs.readFileSync("src/core/textSelection.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { moveTextCaret, selectionWithHead } = context.exports;

test("pad text selection clamps to input bounds", () => {
  assert.equal(moveTextCaret("abc", 0, "left", false), 0);
  assert.equal(moveTextCaret("abc", 3, "right", false), 3);
  assert.equal(moveTextCaret("abc", 1, "right", false), 2);
  assert.equal(moveTextCaret("abc", 2, "left", false), 1);
  assert.equal(moveTextCaret("abc", 2, "up", false), 0);
  assert.equal(moveTextCaret("abc", 1, "down", false), 3);
});

test("multiline up/down keeps visual column as far as possible", () => {
  assert.equal(moveTextCaret("abcd\nx\nxyz", 3, "down", true), 6);
  assert.equal(moveTextCaret("abcd\nx\nxyz", 6, "down", true), 8);
  assert.equal(moveTextCaret("abcd\nx\nxyz", 8, "up", true), 6);
});

test("reverse anchor range never deletes text and reports direction", () => {
  assert.deepEqual({ ...selectionWithHead(5, 2) },
    { start: 2, end: 5, direction: "backward" });
  assert.deepEqual({ ...selectionWithHead(2, 5) },
    { start: 2, end: 5, direction: "forward" });
});

test("Y opens selection first, clear all is explicit, B never activates selection", () => {
  const editor = fs.readFileSync("src/hub/HubTextInput.tsx", "utf8");
  const desktop = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
  const files = fs.readFileSync("src/hub/FileManagerPage.tsx", "utf8");
  const reports = fs.readFileSync("src/hub/ReportsPage.tsx", "utf8");
  const dialog = fs.readFileSync("src/hub/CreateFolderDialog.tsx", "utf8");
  assert.ok(editor.includes("function TextEditControls("));
  assert.ok(editor.includes("onOptionsButton={event => {"));
  assert.ok(editor.includes("onCancelButton={event => {"));
  assert.ok(editor.includes("if (selectingRef.current) exitSelectionMode();"));
  assert.ok(editor.includes("else onExitEdit?.();"));
  assert.ok(!editor.includes("beginOrExitSelection();"));
  assert.ok(editor.includes("startSelectionMode()"));
  assert.ok(editor.includes("startSelectionMode(true)"));
  assert.ok(editor.includes("const [, setSelectionRevision] = useState(0);"));
  assert.ok(editor.includes("onGamepadDirection={event => {"));
  assert.ok(editor.includes("onButtonDown={event => {"));
  assert.ok(editor.includes("moveSelection(direction);"));
  assert.ok(editor.includes("selectionWithHead("));
  assert.ok(editor.includes("navigator.clipboard.writeText(highlighted)"));
  assert.ok(editor.includes("navigator.clipboard.readText()"));
  const firstMenu = editor.indexOf('<Menu label="Edycja tekstu">');
  const selection = editor.indexOf("Tryb zaznaczania tekstu", firstMenu);
  const copy = editor.indexOf(">Kopiuj</MenuItem>", firstMenu);
  assert.ok(firstMenu >= 0 && selection > firstMenu && copy > selection);
  for (const name of ["Kopiuj", "Wytnij", "Wklej", "Zaznacz wszystko", "Wyczyść wszystko"]) {
    assert.ok(editor.includes(name));
  }
  assert.ok(editor.includes("replaceRange(0, value.length, \"\")"));
  assert.ok(editor.includes("Cofnij wyczyszczenie"));
  assert.ok(editor.includes("selectionRowRef.current?.querySelector<HTMLElement>"));
  assert.ok(editor.includes("<DialogButton preferredFocus"));
  assert.ok(editor.includes('onCancelActionDescription="Wyjdź z zaznaczania"'));
  assert.ok(editor.includes("exitSelectionMode();"));
  assert.ok(editor.includes('onEditValue={onEditValue} onExitEdit={onExitEdit}'));
  assert.ok(desktop.includes('onExitEdit={finishSearch}'));
  assert.ok(files.includes('onEditValue={setPathDraft}'));
  assert.ok(files.includes('onEditValue={setName}'));
  assert.ok(reports.includes('onExitEdit={() => finishTitle()}'));
  assert.ok(reports.includes('onExitEdit={finishDetail}'));
  assert.ok(dialog.includes('onEditValue={setName}'));
});

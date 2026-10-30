"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

const source = fs.readFileSync("src/hub/hubScroll.ts", "utf8");
const page = fs.readFileSync("src/hub/HubPage.tsx", "utf8");
const fileManager = fs.readFileSync("src/hub/FileManagerPage.tsx", "utf8");
const desktop = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
const reading = fs.readFileSync("src/hub/GamepadScrollArea.tsx", "utf8");

function scrollMath() {
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const context = { exports: {}, Math, Number };
  vm.runInNewContext(code, context);
  return context.exports;
}

test("right pad scroll accepts wheel lines/pages with a bounded distance", () => {
  const { normalizedScrollDelta } = scrollMath();
  assert.equal(normalizedScrollDelta(3, 1, 500), 108);
  assert.equal(normalizedScrollDelta(-1, 2, 500), -425);
  assert.equal(normalizedScrollDelta(10000, 0, 500), 900);
  assert.equal(normalizedScrollDelta(NaN, 0, 500), 0);
});

test("scroll handlers are attached only while the Hub screen is mounted", () => {
  assert.ok(page.includes("enableHubScroll(shell)"));
  assert.ok(page.includes("return shell ? enableHubScroll(shell) : undefined;"));
  assert.ok(source.includes("window.clearInterval(polling)"));
  assert.ok(source.includes('window.removeEventListener("wheel", onWheel, true)'));
  assert.ok(source.includes('window.removeEventListener("keydown", onKey, true)'));
});

test("only the current open tab on the right is scrollable, not the left sidebar", () => {
  assert.ok(page.includes("data-hub-scroll-page={page.route}"));
  assert.ok(page.includes("overflowY: \"auto\""));
  assert.ok(source.includes("page.querySelectorAll<HTMLElement>(MARKED_SELECTOR)"));
  assert.ok(source.includes("return candidates.find(node => canScroll(node, distance))"));
  assert.ok(!source.includes("page.closest<HTMLElement>(\"[data-hub-shell]\")"));
  assert.ok(!source.includes("parent = parent.parentElement;"));
  assert.ok(!source.includes("SidebarNavigation.querySelector"));
  assert.ok(source.includes("page.contains(event.target)"));
});

test("right analog vertical axis and wheel cannot change controller selection", () => {
  assert.ok(source.includes("pad.axes[3]"));
  assert.ok(source.includes("Math.abs(vertical) < 0.25"));
  assert.ok(source.includes("navigator.getGamepads"));
  assert.ok(source.includes("event.preventDefault()"));
  assert.ok(!source.includes(".focus("));
  assert.ok(!source.includes("dispatchEvent("));
  assert.ok(!source.includes("axes[1]"));
  assert.ok(source.includes("isEditing(document.activeElement)"));
});

test("existing desktop, file and text-reading content keeps independent scroll areas", () => {
  assert.ok(desktop.includes('data-hub-scroll-container="desktop-list"'));
  assert.ok(fileManager.includes('data-hub-scroll-container={pane === "left" ? "file-tree" : "file-list"}'));
  assert.ok(reading.includes('data-hub-scroll-container="reading"'));
  assert.ok(reading.includes('target.scrollIntoView('));
  assert.ok(desktop.includes('ref={scrollRef}'));
  assert.ok(fileManager.includes('files.listScrollTop'));
});

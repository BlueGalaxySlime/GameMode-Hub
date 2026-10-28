"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

const source = fs.readFileSync("src/core/desktopCatalog.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const env = { exports: {}, Map, Set };
vm.runInNewContext(js, env);
const { filterDesktopApps, searchableName } = env.exports;

const apps = [
  { id: "firefox", name: "Firefox", flatpak: true },
  { id: "dolphin", name: "Dolphin", flatpak: false },
  { id: "heroic", name: "Heroic", flatpak: true },
  { id: "steam", name: "Steam Settings", flatpak: false },
  { id: "hidden", name: "Ukryta aplikacja", flatpak: false }
];
const stored = {
  firefox: { favorite: true, lastOpened: 111 },
  heroic: { lastOpened: 999 },
  dolphin: { lastOpened: 222 },
  hidden: { hidden: true }
};

function names(category, search = "", sort = "name-asc") {
  return filterDesktopApps(apps, stored, category, search, sort).map(a => a.id);
}

test("All excludes hidden entries but retains Flatpaks and system applications", () => {
  assert.deepEqual(names("all"), ["dolphin", "firefox", "heroic", "steam"]);
});
test("Flatpak view includes only Flatpaks", () => {
  assert.deepEqual(names("flatpak"), ["firefox", "heroic"]);
});
test("System view excludes Flatpaks", () => {
  assert.deepEqual(names("system"), ["dolphin", "steam"]);
});
test("Favorites view includes saved favorites only", () => {
  assert.deepEqual(names("favorites"), ["firefox"]);
});
test("Hidden view includes hidden apps instead of blanking them", () => {
  assert.deepEqual(names("hidden"), ["hidden"]);
});
test("Search works inside each view and ignores case/Polish diacritics", () => {
  assert.deepEqual(names("flatpak", "FIRE"), ["firefox"]);
  assert.deepEqual(names("hidden", "UKRYTA"), ["hidden"]);
  assert.deepEqual(names("system", "Firefox"), []);
  assert.equal(searchableName("Łódź"), "łodz");
});
test("Sorting by name and recent works without changing selected category", () => {
  assert.deepEqual(names("all", "", "name-desc"), ["steam", "heroic", "firefox", "dolphin"]);
  assert.deepEqual(names("all", "", "recent"), ["heroic", "dolphin", "firefox", "steam"]);
  assert.deepEqual(names("all", "", "recommended"), ["firefox", "heroic", "dolphin", "steam"]);
});
test("Original input data is not mutated by catalogue sorting", () => {
  const before = apps.map(app => app.id);
  filterDesktopApps(apps, stored, "all", "", "name-desc");
  assert.deepEqual(apps.map(app => app.id), before);
});

/**
 * Test Decky loader activation detection without a real SteamOS runtime.
 * A disabled plugin may remain installed on disk, but hasPlugin() is false.
 */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/modules/tab-manager/TabMasterDetection.ts"), "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context, { filename: "TabMasterDetection.js" });
const { getTabMasterActivity } = context.exports;

test("active TabMaster blocks SteamHub library integration", () => {
  const activePlugins = new Set(["SteamHub", "TabMaster"]);
  assert.equal(getTabMasterActivity({
    hasPlugin: name => activePlugins.has(name)
  }), "active");
});

test("installed but disabled TabMaster does NOT block SteamHub", () => {
  // TabMaster remains installed but is absent from Decky's loaded plugins.
  const activePlugins = new Set(["SteamHub"]);
  assert.equal(getTabMasterActivity({
    hasPlugin: name => activePlugins.has(name)
  }), "inactive");
});

test("uninstalled TabMaster does not block SteamHub", () => {
  assert.equal(getTabMasterActivity({ hasPlugin: () => false }), "inactive");
});

test("unavailable plugin loader is not mistaken for active TabMaster", () => {
  assert.equal(getTabMasterActivity(undefined), "unknown");
  assert.equal(getTabMasterActivity({ hasPlugin: () => { throw Error("loader unavailable"); } }), "unknown");
});

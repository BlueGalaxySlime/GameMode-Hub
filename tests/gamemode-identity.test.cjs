"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const plugin=JSON.parse(fs.readFileSync("plugin.json","utf8"));
const identity=fs.readFileSync("src/core/identity.ts","utf8");
const index=fs.readFileSync("src/index.tsx","utf8");
const backend=fs.readFileSync("main.py","utf8");
const updater=fs.readFileSync("src/hub/UpdaterPage.tsx","utf8");
const catalog=fs.readFileSync("src/core/releaseCatalog.ts","utf8");
const workflow=fs.readFileSync(".github/workflows/build.yml","utf8");
test("Decky manifest and frontend share the exact plugin identity",()=>{
  assert.equal(plugin.name,"GameMode Hub");
  assert.match(identity,/DECKY_PLUGIN_NAME = "GameMode Hub"/);
  assert.match(index,/name: DECKY_PLUGIN_NAME/);
});
test("new lightweight release points to the renamed repo and ZIP",()=>{
  assert.match(backend,/ASSET_NAME = "GameMode-Hub.zip"/);
  assert.match(backend,/BlueGalaxySlime\/GameMode-Hub/);
  assert.match(catalog,/GameMode-Hub\.zip/);
  assert.match(updater,/compareVersions|selectReleases/);
  assert.match(workflow,/release\/GameMode-Hub.zip/);
  assert.doesNotMatch(workflow,/npm run package --prefix desktop|needs: \[build, desktop\]/);
});
test("native SteamOS route and no standalone window are used",()=>{
  assert.match(identity,/HUB_ROUTE = "\/gamemodehub"/);
  assert.match(index,/routerHook.addRoute/);
  assert.doesNotMatch(index,/Electron|BrowserWindow/);
});

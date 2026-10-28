"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("src/hub/epicAccountAdapter.ts", "utf8");
const account = fs.readFileSync("src/hub/AccountsPage.tsx", "utf8");
const hub = fs.readFileSync("src/hub/HubPage.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function loadAdapter({failTrack=false, returnStarted=true}={}) {
  const actions = [];
  let stopped;
  const imports = {
    "@decky/api": {
      callable: (key) => (...args) => {
        actions.push([key, ...args]);
        if (key === "desktop_remember_temporary" && failTrack)
          return Promise.reject(new Error("failed to record shortcut"));
        return Promise.resolve([]);
      }
    },
    "../utils/withTimeout": { withTimeout: promise => promise },
    "./desktopLaunch": {
      createSteamDesktopShortcut: async () => {
        actions.push(["create"]); return {appId: 123};
      },
      openSteamDesktopShortcut: async (_, onClosed) => {
        actions.push(["launch"]);
        stopped = onClosed;
        return returnStarted;
      },
      removeSteamDesktopShortcut: () => { actions.push(["remove"]); }
    }
  };
  const module = { exports: {} };
  const wrapper = vm.runInNewContext("(function(require, module, exports){" + compiled + "\n})");
  wrapper(key => {
    if (!(key in imports)) throw new Error("Unexpected import " + key);
    return imports[key];
  }, module, module.exports);
  return {adapter: module.exports, actions, close: async () => stopped?.()};
}

const epic = {id:"epic-games-launcher",name:"Epic Games Launcher",bin:"/usr/bin/flatpak",cmd:"run app",workdir:"/home/deck",flatpak:true};
const heroic = {id:"com.heroicgameslauncher.hgl",name:"Heroic Games Launcher",bin:"flatpak",cmd:"run com.heroicgameslauncher.hgl",workdir:"/home/deck",flatpak:true};

test("launcher recognition is exact and never treats a display name as authentication", () => {
  const {adapter} = loadAdapter();
  const found=adapter.identifyEpicLaunchers([
    heroic, epic, {...epic,id:"random-browser-shortcut"}, {...heroic,flatpak:false}
  ]);
  assert.deepEqual(Array.from(found, v=>v.provider), ["epic","heroic"]);
  assert.equal(adapter.identifyEpicLaunchers([{...epic,id:"fake-epic"}]).length, 0);
});

test("explicit Steam launcher handoff tracks the shortcut and removes it on exit", async () => {
  const x=loadAdapter(), launcher=x.adapter.identifyEpicLaunchers([epic])[0];
  await x.adapter.openEpicLauncher(launcher);
  assert.deepEqual(x.actions.map(a=>a[0]), ["create","desktop_remember_temporary","launch"]);
  await x.close();
  assert.deepEqual(x.actions.map(a=>a[0]), ["create","desktop_remember_temporary","launch","remove","desktop_forget_temporary"]);
});

test("tracking failure fails closed without launching and removes the shortcut", async () => {
  const x=loadAdapter({failTrack:true}), launcher=x.adapter.identifyEpicLaunchers([epic])[0];
  await assert.rejects(x.adapter.openEpicLauncher(launcher));
  assert.deepEqual(x.actions.map(a=>a[0]), ["create","desktop_remember_temporary","remove"]);
});

test("Steam rejection cleans the temporary shortcut", async () => {
  const x=loadAdapter({returnStarted:false}), launcher=x.adapter.identifyEpicLaunchers([epic])[0];
  await assert.rejects(x.adapter.openEpicLauncher(launcher));
  assert.deepEqual(x.actions.map(a=>a[0]), ["create","desktop_remember_temporary","launch","remove","desktop_forget_temporary"]);
});

test("unknown shortcut is rejected before creating any Steam resource", async () => {
  const x=loadAdapter(), fake={app:{...epic,id:"fake"},provider:"epic",label:"Epic"};
  await assert.rejects(x.adapter.openEpicLauncher(fake));
  assert.equal(x.actions.length,0);
});

test("Epic accounts stay credential-free and do not call UniFiDeck auth or report a fake login", () => {
  assert.match(account,/Status konta: niezweryfikowany/);
  assert.match(account,/Magazyn poświadczeń/);
  assert.match(account,/openEpicLauncher/);
  assert.match(hub,/<AccountsPage \/>/);
  for (const filename of [source,account]) {
    assert.doesNotMatch(filename, /readUnifideckStatuses|check_store_status|store_auth|readFileSync|secret-tool/);
  }
});

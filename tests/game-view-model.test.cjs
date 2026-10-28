"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const src = fs.readFileSync("src/game-view/gameModel.ts","utf8");
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}, Number, Object, String};
vm.runInNewContext(compiled,context);
const {normalizeGame, detectSource, isShortcut}=context.exports;

test("Steam game and GOG shortcut share one normalized UI contract",()=>{
  const steam=normalizeGame({appid:620, display_name:"Portal 2",
    minutes_playtime_forever:220, rt_last_time_played:1700000000},{nPlaytimeForever:240});
  assert.equal(steam.source,"steam");assert.equal(steam.shortcut,false);
  assert.equal(steam.protonDbAppId,"620");
  assert.equal(steam.playedMinutes,240);
  const gog=normalizeGame({appid:3221225472,display_name:"A Plague Tale",app_type:1073741824},
    {strShortcutLaunchOptions:"--store=gog"});
  assert.equal(gog.source,"gog");assert.equal(gog.shortcut,true);
  assert.equal(gog.protonDbAppId,null);
});

test("Unknown source never guesses by game title and bad AppIDs fail closed",()=>{
  const unknown=normalizeGame({appid:3221225472,display_name:"Some GOG Game"},
    {strShortcutLaunchOptions:""});
  assert.equal(unknown.source,"external");
  assert.equal(normalizeGame({appid:"broken"},{}),null);
  assert.equal(normalizeGame({appid:0},{}),null);
  assert.equal(detectSource(true,"heroic --store epic"),"epic");
  assert.equal(isShortcut(0x80000000,0),true);
});

test("UI patch is opt-in, additive and removable without replacing Play",()=>{
  const patch=fs.readFileSync("src/game-view/gamePagePatch.tsx","utf8");
  const ui=fs.readFileSync("src/game-view/UnifiedGameStrip.tsx","utf8");
  const entry=fs.readFileSync("src/index.tsx","utf8");
  const page=fs.readFileSync("src/hub/UiPage.tsx","utf8");
  assert.ok(patch.includes('if (!gameUiOptions().enabled'));
  assert.ok(patch.includes('routerHook.removePatch(ROUTE,installed)'));
  assert.ok(patch.includes('<UnifiedGameStrip key={KEY}'));
  assert.ok(ui.includes('Źródło / ProtonDB'));
  assert.ok(ui.includes('getMapping(String(id))'));
  assert.ok(ui.includes('gameUiOptions().show_protondb'));
  assert.ok(ui.includes('Navigation.NavigateToExternalWeb(badge.url)'));
  assert.ok(page.includes('>Gaming Mode</DialogButton>'));
  assert.ok(page.includes('>Obraz</DialogButton>'));
  assert.ok(page.includes('>Konsola</DialogButton>'));
  assert.ok(page.includes('<ProtonDBPage />'));
  assert.ok(entry.includes('stopGameUi()'));
  assert.ok(!patch.includes('replacePatch('));
});

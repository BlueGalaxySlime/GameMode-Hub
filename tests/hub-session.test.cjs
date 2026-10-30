"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"),ts=require("typescript"),vm=require("node:vm");
const source=fs.readFileSync("src/core/hubSession.ts","utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{},Set,Map};vm.runInNewContext(code,context);
const {getHubPreferences,applyHubPreferences,readHubSession,writeHubSession,clearHubSessions}=context.exports;
test("session states survive simulated tab unmounts",()=>{
  clearHubSessions();
  writeHubSession("files.path","/home/deck/Downloads");
  writeHubSession("files.sort","date-desc");
  assert.equal(readHubSession("files.path",null),"/home/deck/Downloads");
  assert.equal(readHubSession("files.sort",null),"date-desc");
});
test("turning session save off clears sessions and prevents new saves",()=>{
  applyHubPreferences({saveSession:false,splitFileTree:false});
  assert.equal(readHubSession("files.path",null),null);
  writeHubSession("files.path","/secret");
  assert.equal(readHubSession("files.path",null),null);
  applyHubPreferences({saveSession:true,splitFileTree:false});
  assert.equal(readHubSession("files.path",null),null);
});
test("split and automatic keyboard are independent Hub preferences",()=>{
  applyHubPreferences({saveSession:true,splitFileTree:true,autoKeyboard:false});
  assert.equal(getHubPreferences().splitFileTree,true);
  assert.equal(getHubPreferences().autoKeyboard,false);
  assert.equal(getHubPreferences().saveSession,true);
  applyHubPreferences({saveSession:true,splitFileTree:false,autoKeyboard:true});
  assert.equal(getHubPreferences().autoKeyboard,true);
  assert.equal(getHubPreferences().splitFileTree,false);
});
test("legacy two-key preferences preserve the keyboard default",()=>{
  applyHubPreferences({saveSession:true,splitFileTree:false,autoKeyboard:true});
  applyHubPreferences({saveSession:true,splitFileTree:true});
  assert.equal(getHubPreferences().splitFileTree,true);
  assert.equal(getHubPreferences().autoKeyboard,true);
});

test("Developer measurements are opt-in and not enabled by legacy settings",()=>{
  applyHubPreferences({developerMode:false});
  assert.equal(getHubPreferences().developerMode,false);
  applyHubPreferences({developerMode:true});
  assert.equal(getHubPreferences().developerMode,true);
  applyHubPreferences({developerMode:false});
});

test("only Polish and English are accepted and the selection survives tab switches",()=>{
  applyHubPreferences({language:"en",saveSession:true});
  writeHubSession("test.language","preserved");
  assert.equal(getHubPreferences().language,"en");
  assert.equal(readHubSession("test.language",null),"preserved");
  applyHubPreferences({language:"pl"});
  assert.equal(getHubPreferences().language,"pl");
  applyHubPreferences({language:"es"});
  assert.equal(getHubPreferences().language,"pl");
  applyHubPreferences({language:"en"});
  assert.equal(getHubPreferences().language,"en");
});

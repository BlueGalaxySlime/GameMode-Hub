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
test("split controls only directory tree preference",()=>{
  applyHubPreferences({saveSession:true,splitFileTree:true});
  assert.equal(getHubPreferences().splitFileTree,true);
  assert.equal(getHubPreferences().saveSession,true);
  applyHubPreferences({saveSession:true,splitFileTree:false});
});

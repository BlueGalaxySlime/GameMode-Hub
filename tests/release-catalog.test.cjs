"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("src/core/releaseCatalog.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
}}).outputText;
const context = { exports:{} };
vm.runInNewContext(compiled,context);
const {selectReleases, compareVersions} = context.exports;
const root = "https://github.com/BlueGalaxySlime/GameMode-Hub/releases/download/";
function item(tag, prerelease=true) {
  return {tag_name:tag,prerelease,draft:false,assets:[{
    name:"GameMode-Hub.zip",
    browser_download_url:root + tag + "/GameMode-Hub.zip",
    digest:"sha256:" + "a".repeat(64)
  }]};
}
test("stable remains empty even with numeric prerelease and historical 0.5.2",()=>{
  assert.equal(selectReleases([item("v0.5.2",false),item("v0.5.4",true)],"stable","0.5.4").length,0);
});
test("the Test channel includes 0.5.2 rollback and sorted newer prereleases",()=>{
  const data=[item("v0.5.2",false),item("v0.5.5",true),item("v0.5.4",true),item("v0.5.3-test.1",true)];
  const rows=selectReleases(data,"test","0.5.4");
  assert.deepEqual(Array.from(rows,x=>x.version),["0.5.5","0.5.4","0.5.3-test.1","0.5.2"]);
  assert.deepEqual(Array.from(rows,x=>x.action),["upgrade","installed","downgrade","downgrade"]);
  assert.equal(rows[3].legacy,true);
});
test("release candidates with malicious path, no digest, or wrong channel are not installable",()=>{
  const wrong=item("v0.5.6");wrong.assets[0].browser_download_url="https://example.org/trick.zip";
  const digest=item("v0.5.7");digest.assets[0].digest=null;
  const draft=item("v0.5.8");draft.draft=true;
  const badLabel=item("v0.5.9",false);
  const legacy=item("v0.5.1",false);
  assert.equal(selectReleases([wrong,digest,draft,badLabel,legacy],"test","0.5.4").length,0);
});
test("future Stable versions require 0.6.0+ and a published non-prerelease tag",()=>{
  assert.deepEqual(Array.from(selectReleases([
    item("v0.6.0",false),item("v0.6.1-test.1",true),item("v0.5.3",false)
  ],"stable","0.5.4"),r=>r.version),["0.6.0"]);
});
test("version ordering handles test numbers and stable final",()=>{
  assert.equal(compareVersions("0.5.3-test.10","0.5.3-test.2"),1);
  assert.equal(compareVersions("0.5.3","0.5.3-test.99"),1);
  assert.equal(compareVersions("0.5.2","0.5.3-test.1"),-1);
});

test("channel is defined by GitHub prerelease metadata, not a tag suffix",()=>{
  const testRelease=selectReleases([item("v0.5.4",true)],"test","0.5.4");
  assert.equal(testRelease.length,1);
  assert.equal(testRelease[0].version,"0.5.4");
  assert.equal(selectReleases([item("v0.5.4",true)],"stable","0.5.4").length,0);
});

test("old stable latest 0.5.2 must not mask a newer test release",()=>{
  const githubListing = [item("v0.5.5", true), item("v0.5.4", true), item("v0.5.2", false)];
  const rows = selectReleases(githubListing, "test", "0.5.4");
  assert.deepEqual(Array.from(rows, r => r.version), ["0.5.5", "0.5.4", "0.5.2"]);
  assert.equal(rows[0].action,"upgrade");
  assert.equal(selectReleases(githubListing, "stable", "0.5.4").length, 0);
});

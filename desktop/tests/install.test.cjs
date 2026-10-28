"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const { desktopEntry,installAppImage,targetPaths }=require("../lib/install.cjs");
const {readOsRelease,platformInfo}=require("../lib/platform.cjs");

test("standalone desktop entry quotes AppImage path and does not start a terminal",()=>{
  const source="/home/test/plik z odstępem/SteamHub.AppImage";
  const entry=desktopEntry(source);
  assert.match(entry,/Exec="\/home\/test\/plik z odstępem\/SteamHub\.AppImage"/);
  assert.match(entry,/Terminal=false/);
  assert.match(entry,/X-SteamHub-Managed=true/);
});
test("installer copies AppImage and creates a user desktop shortcut",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"steamhub-installer-"));
  const home=path.join(root,"home");
  const input=path.join(root,"SteamHub.AppImage");
  fs.mkdirSync(home);
  fs.writeFileSync(input,"fake-binary");
  try {
    const paths=await installAppImage(input,home);
    assert.equal(fs.readFileSync(paths.binary,"utf8"),"fake-binary");
    assert.ok(fs.statSync(paths.binary).mode & 0o100);
    assert.match(fs.readFileSync(paths.desktop,"utf8"),/SteamHub/);
  }finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("installer rejects non-AppImage and relative inputs",async()=>{
  await assert.rejects(installAppImage("some.AppImage"),/oficjalnego/);
  await assert.rejects(installAppImage("/tmp/test.sh"),/AppImage/);
});
test("platform detector gracefully provides Linux OS information",()=>{
  assert.equal(typeof readOsRelease().id,"string");
  assert.equal(typeof platformInfo().arch,"string");
});

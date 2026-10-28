"use strict";
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { platformInfo } = require("./lib/platform.cjs");
const { installAppImage, targetPaths } = require("./lib/install.cjs");
const VERSION = require("./package.json").version;
const RELEASES = "https://github.com/BlueGalaxySlime/SteamOS-Hub/releases";

function withinHome(candidate, home) {
  return candidate===home || candidate.startsWith(home+path.sep);
}
async function browseFolder(requested) {
  // A minimal, intentionally read-only file browser. Symlink destinations
  // outside the user's home are rejected instead of accidentally exposed.
  const home = await fs.realpath(os.homedir());
  const target = await fs.realpath(requested || home);
  if (!withinHome(target, home)) throw new Error("Można przeglądać wyłącznie katalog domowy.");
  const items = await fs.readdir(target, {withFileTypes:true});
  const results = await Promise.all(items.slice(0,600).map(async item => {
    try {
      const resolved = await fs.realpath(path.join(target,item.name));
      if (!withinHome(resolved,home)) return null;
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory() && !stat.isFile()) return null;
      return {name:item.name, directory:stat.isDirectory(), path:resolved};
    } catch {return null;}
  }));
  return {path:target, parent:target===home?null:path.dirname(target), items:results.filter(Boolean).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name,"pl"))};
}
async function createMainWindow() {
  const win = new BrowserWindow({
    width:1200,height:760,minWidth:750,minHeight:480,
    title:"SteamHub",backgroundColor:"#111b29",autoHideMenuBar:true,
    webPreferences:{
      preload:path.join(__dirname,"preload.cjs"),
      contextIsolation:true,nodeIntegration:false,sandbox:true,
      webSecurity:true
    }
  });
  win.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  win.webContents.on("will-navigate",e=>e.preventDefault());
  await win.loadFile(path.join(__dirname,"ui","index.html"));
}
app.whenReady().then(async()=>{
  ipcMain.handle("hub:info",async()=>({
    version:VERSION,platform:platformInfo(), installed:
      await fs.stat(targetPaths().desktop).then(()=>true,()=>false)
  }));
  ipcMain.handle("hub:list-files",async(_event,requested)=>{
    if(requested!==undefined && (typeof requested!=="string" || requested.length>4096))
      throw new Error("Nieprawidłowa ścieżka.");
    return browseFolder(requested);
  });
  ipcMain.handle("hub:install",async()=>{
    if(process.platform!=="linux" || process.env.FLATPAK_ID) {
      throw new Error("Pakiet Flatpak jest instalowany przez Discover.");
    }
    return installAppImage(process.env.APPIMAGE);
  });
  ipcMain.handle("hub:open-releases",async()=>{
    await shell.openExternal(RELEASES);
    return true;
  });
  await createMainWindow();
});
app.on("window-all-closed",()=>{app.quit();});

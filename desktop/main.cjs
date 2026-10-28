"use strict";
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { browseFolder } = require("./lib/files.cjs");
const { platformInfo } = require("./lib/platform.cjs");
const { installAppImage, targetPaths } = require("./lib/install.cjs");
const VERSION = require("./package.json").version;
const RELEASES = "https://github.com/BlueGalaxySlime/SteamOS-Hub/releases";

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
  ipcMain.handle("hub:list-files",async(_event,requested)=>browseFolder(requested));
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

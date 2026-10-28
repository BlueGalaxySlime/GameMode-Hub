"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("steamHub", Object.freeze({
  info:()=>ipcRenderer.invoke("hub:info"),
  listFiles:(path)=>ipcRenderer.invoke("hub:list-files",path),
  install:()=>ipcRenderer.invoke("hub:install"),
  releases:()=>ipcRenderer.invoke("hub:open-releases")
}));

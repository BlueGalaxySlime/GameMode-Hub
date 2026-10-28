"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const DESKTOP_ID = "io.github.BlueGalaxySlime.SteamHub";
function targetPaths(home = os.homedir(), dataHome = path.join(home, ".local", "share")) {
  const root = path.join(dataHome, "SteamHub");
  return { root, binary: path.join(root, "SteamHub.AppImage"),
    desktop: path.join(dataHome, "applications", DESKTOP_ID + ".desktop") };
}
function desktopEntry(binary) {
  // Freedesktop .desktop Exec quoting: escape double quote, backslash, $, backtick.
  const quoted = binary.replace(/[\\$"`]/g, "\\$&");
  return [
    "[Desktop Entry]", "Type=Application", "Version=1.0",
    "Name=SteamHub", "Comment=Samodzielny panel SteamOS Hub",
    "Exec=\"" + quoted + "\"", "Terminal=false",
    "Categories=Utility;System;", "StartupWMClass=SteamHub",
    "X-SteamHub-Managed=true", ""
  ].join("\n");
}
async function installAppImage(source, home = os.homedir(), dataHome) {
  if (!source || !path.isAbsolute(source) || path.extname(source) !== ".AppImage") {
    throw new Error("Instalacja wymaga uruchomienia oficjalnego pakietu AppImage.");
  }
  const src = await fs.stat(source);
  if (!src.isFile()) throw new Error("Nie znaleziono pliku AppImage.");
  const paths = targetPaths(home, dataHome);
  await fs.mkdir(paths.root, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.dirname(paths.desktop), { recursive: true });
  // Never overwrite the running AppImage in place or leave a half-written file.
  if (path.resolve(source) !== path.resolve(paths.binary)) {
    const staging = paths.binary + "." + process.pid + ".tmp";
    try {
      await fs.copyFile(source, staging);
      await fs.chmod(staging, 0o755);
      await fs.rename(staging, paths.binary);
    } finally { await fs.rm(staging, { force: true }); }
  } else {
    await fs.chmod(paths.binary, 0o755);
  }
  const tmp = paths.desktop + "." + process.pid + ".tmp";
  try {
    await fs.writeFile(tmp, desktopEntry(paths.binary), { encoding:"utf8",mode:0o644 });
    await fs.rename(tmp, paths.desktop);
  } finally { await fs.rm(tmp,{force:true}); }
  return paths;
}
module.exports = { targetPaths, desktopEntry, installAppImage };

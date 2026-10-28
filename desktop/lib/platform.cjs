"use strict";
const fs = require("node:fs");
const os = require("node:os");
function readOsRelease() {
  try {
    const text = fs.readFileSync("/etc/os-release", "utf8");
    const lines = {};
    for (const entry of text.split("\n")) {
      const m = entry.match(/^([A-Z_]+)=(.*)$/);
      if (m) lines[m[1]] = m[2].replace(/^["']|["']$/g,"");
    }
    return { name:lines.PRETTY_NAME || lines.NAME || "Linux", id:lines.ID || "linux", like:lines.ID_LIKE || "" };
  } catch { return { name:"Linux", id:"linux", like:"" }; }
}
function platformInfo() {
  const distro = readOsRelease();
  return { ...distro, arch:process.arch, os:process.platform,
    steamOS:distro.id==="steamos"||distro.id==="holo"||/steamos|holo/.test(distro.like),
    flatpak:Boolean(process.env.FLATPAK_ID),
    appImage:Boolean(process.env.APPIMAGE),
    home:os.homedir()
  };
}
module.exports={readOsRelease,platformInfo};

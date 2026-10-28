"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
const os=require("node:os");
function withinHome(candidate,home){
  return candidate===home||candidate.startsWith(home+path.sep);
}
/** Read-only browser that refuses paths outside home after resolving symlinks. */
async function browseFolder(requested,homePath=os.homedir()){
  const home=await fs.realpath(homePath);
  if(requested!==undefined && (typeof requested!=="string"||requested.length>4096))
    throw new Error("Nieprawidłowa ścieżka.");
  const target=await fs.realpath(requested||home);
  if(!withinHome(target,home))throw new Error("Można przeglądać wyłącznie katalog domowy.");
  const items=await fs.readdir(target,{withFileTypes:true});
  const results=await Promise.all(items.slice(0,600).map(async item=>{
    try{
      const resolved=await fs.realpath(path.join(target,item.name));
      if(!withinHome(resolved,home))return null;
      const stat=await fs.stat(resolved);
      if(!stat.isDirectory()&&!stat.isFile())return null;
      return {name:item.name,directory:stat.isDirectory(),path:resolved};
    }catch{return null;}
  }));
  return {path:target,parent:target===home?null:path.dirname(target),
    items:results.filter(Boolean).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name,"pl"))};
}
module.exports={browseFolder,withinHome};

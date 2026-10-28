import { withTimeout } from "../utils/withTimeout";
import { readUnifideckStatuses } from "./unifideckBridge";

/** Epic-only test adapter. Unifideck continues to own Legendary, OAuth,
 * browser sessions and download workers. Hub never reads or persists tokens.
 * The Decky RPC contract accepts (pluginName, method, ...positionalArgs).
 */
type Backend = { callable: (method:string)=>(...args:unknown[])=>Promise<unknown> };
type AuthContext = { launcher_path?:unknown; error?:unknown };
type SteamApps = {
  AddShortcut?: (name:string, exe:string, startDir:string, launch:string)=>Promise<number>;
  SetShortcutLaunchOptions?: (id:number, options:string)=>void;
  SpecifyCompatTool?: (id:number, tool:string)=>void;
  RunGame?: (gameId:string, options:string, flags:number, source:number)=>void;
  RemoveShortcut?: (id:number)=>void;
};
export type EpicQueueItem = { game: string; state:string; progress:string };
export type EpicStatus = { connected:boolean; available:boolean };

function unwrap(response:unknown):unknown {
  if(response && typeof response==="object" && "data" in response && "success" in response){
    const envelope=response as {success:boolean;data:unknown};
    if(!envelope.success) throw new Error("Unifideck nie wykonał operacji.");
    return envelope.data;
  }
  return response;
}
async function invoke(method:"store_auth"|"get_epic_auth_shortcut_context"|"get_download_queue",...args:unknown[]) {
  const backend=(window as Window & {DeckyBackend?:Backend}).DeckyBackend;
  if(typeof backend?.callable!=="function")throw new Error("Brak połączenia z Decky.");
  return unwrap(await withTimeout(
    backend.callable("loader/call_plugin_method")("Unifideck",method,...args),12000
  ));
}
export async function epicStatus():Promise<EpicStatus> {
  const stores=await readUnifideckStatuses();
  const epic=stores.find(x=>x.id==="epic");
  return {connected:epic?.connected===true,available:!!epic};
}
function apps():SteamApps {
  return (window as Window & {SteamClient?:{Apps?:SteamApps}}).SteamClient?.Apps || {};
}
function scheduleCleanup(appId:number) {
  // Never remove the shortcut while its login window may still be running;
  // the Unifideck auth launcher has a 10-minute ceiling. Best-effort
  // safeguard only; no idle polling or background service.
  window.setTimeout(()=>{ try { apps().RemoveShortcut?.(appId); } catch {} },35*60*1000);
}
function safeLauncherPath(v:unknown):v is string {
  return typeof v==="string" && v.startsWith("/") &&
    /\/Unifideck\/bin\/unifideck-launcher$/.test(v);
}
async function launchEpicAuthShortcut(context:AuthContext):Promise<void> {
  if(!safeLauncherPath(context.launcher_path)) throw new Error("Brak bezpiecznej ścieżki launchera Epic.");
  const steam=apps();
  if(!steam.AddShortcut||!steam.RunGame||!steam.SetShortcutLaunchOptions||!steam.RemoveShortcut)
    throw new Error("SteamOS nie udostępnia uruchamiania skrótów.");
  const name="Epic Games Sign-In";
  const exe=context.launcher_path;
  const opts="epic:epic-auth-temp-"+Date.now()+" UNIFIDECK_EPIC_ACTION=auth";
  let id:number|undefined;
  try{
    id=await withTimeout(steam.AddShortcut(name,exe,exe.slice(0,exe.lastIndexOf("/")),opts),6500);
    if(!Number.isInteger(id)||!id)throw new Error("Steam nie utworzył skrótu logowania.");
    steam.SetShortcutLaunchOptions(id,opts);
    // Steam has to register a new shortcut in memory before RunGame.
    // Without this, Gaming Mode can show "Game configuration unavailable".
    const map=(window as Window & {
      appStore?: {m_mapApps?: {get:(n:number)=>{gameid?:unknown}|undefined}}
    }).appStore?.m_mapApps;
    const until=Date.now()+5000;
    let registered=false;
    while(Date.now()<until){
      const entry=map?.get(id | 0) || map?.get(id >>> 0);
      if(typeof entry?.gameid==="string"&&entry.gameid.length>0){
        registered=true;break;
      }
      await new Promise<void>(resolve=>window.setTimeout(resolve,250));
    }
    if(!registered)throw new Error("Steam nie zarejestrował skrótu logowania.");
    // Same formula used by Steam for non-Steam shortcut GameIDs.
    const gameId=((BigInt(id>>>0)<<32n)|0x02000000n).toString();
    steam.SpecifyCompatTool?.(id,"");
    steam.RunGame(gameId,"",-1,100);
    scheduleCleanup(id);
  }catch(e){
    if(id){try{steam.RemoveShortcut?.(id);}catch{}}
    throw e;
  }
}
export async function startEpicLogin():Promise<"connected"|"started"> {
  const raw=await invoke("store_auth","epic","start");
  const result=raw && typeof raw==="object" ? raw as {
    success?:unknown;error?:unknown;metadata?:{pending?:unknown}
  } : {};
  if(result.success===false)
    throw new Error(typeof result.error==="string"?result.error:"Nie uruchomiono logowania Epic.");
  if(result.success===true && result.metadata?.pending!==true)return "connected";
  const context=await invoke("get_epic_auth_shortcut_context") as AuthContext;
  await launchEpicAuthShortcut(context);
  return "started";
}
/** Read only Unifideck's queue: never invoke install_game without an
 * explicit selected game and a separate confirmation dialog. */
export async function epicDownloadQueue():Promise<EpicQueueItem[]> {
  const raw=await invoke("get_download_queue");
  const obj=raw && typeof raw==="object" ? raw as Record<string,unknown> : {};
  const rows=Array.isArray(raw)?raw:Array.isArray(obj.items)?obj.items:
    Array.isArray(obj.jobs)?obj.jobs:Array.isArray(obj.queue)?obj.queue:[];
  return rows.slice(0,30).filter((r:unknown)=>r && typeof r==="object")
    .filter((r:unknown)=>{const d=r as Record<string,unknown>;return d.store==="epic"||d.store_id==="epic";})
    .map((r:unknown)=>{const d=r as Record<string,unknown>;return {
      game:String(d.title??d.game_id??"Gra Epic").slice(0,90),
      state:String(d.status??d.state??"Oczekuje").slice(0,35),
      progress:typeof d.progress==="number"&&Number.isFinite(d.progress)
        ?Math.round(d.progress)+"%":""
    };});
}

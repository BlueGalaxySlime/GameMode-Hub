import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogButton, Focusable, ModalRoot, DialogBody, Menu, MenuGroup, MenuItem,
  Navigation, showModal, showContextMenu, NavEntryPositionPreferences
} from "@decky/ui";
import { HubTextInput } from "../hub/HubTextInput";
import { gameUiOptions } from "./gameViewStore";
import { GAME_SOURCES, normalizeGame } from "./gameModel";
import type { GameSource, UnifiedGame } from "./gameModel";
import { gameCommunityActions, gameTabsFor } from "./gameTabs";
import type { GameTab } from "./gameTabs";
import { withTimeout } from "../utils/withTimeout";

type Mapping = { client: GameSource | null; steam_id: string | null };
type Badge = { tier: string; url: string; reports: number };
const getMapping = callable<[string], Mapping>("game_view_get_mapping");
const setMapping = callable<[string, GameSource, string | null], Mapping>("game_view_set_mapping");
const getBadge = callable<[string, boolean], Badge>("protondb_get_badge");
const tierLabel: Record<string, string> = {
  platinum:"Platinum", gold:"Gold", silver:"Silver", bronze:"Bronze",
  borked:"Borked", native:"Native", pending:"Pending", unrated:"Bez oceny", error:"Offline"
};
const label = (source: GameSource) =>
  GAME_SOURCES.find(item => item.value === source)?.label ?? "Inny launcher";

/** A shared info row for all Steam native games and non-Steam shortcuts. Never
 * overrides Steam's Play button, native license controls, launch or updates.
 * All expensive requests are done only while a game page is open.
 */
export function UnifiedGameStrip({ overview, details }: { overview: unknown; details: unknown }) {
  const game = normalizeGame(overview, details);
  const id = game?.appId;
  const [mapping, setAssigned] = useState<Mapping | null>(null);
  const [badge, setBadge] = useState<Badge | null>(null);
  const [tab, setTab] = useState<GameTab>("activity");
  useEffect(() => {
    let mounted = true;
    setAssigned(null);
    setBadge(null);
    setTab("activity");
    if (!id || !game?.shortcut) return;
    void withTimeout(getMapping(String(id)), 4000).then(result => {
      if (mounted) setAssigned(result);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [id, game?.shortcut]);

  const protonId = game?.shortcut ? mapping?.steam_id : game?.protonDbAppId;
  useEffect(() => {
    let mounted = true;
    setBadge(null);
    if (tab !== "details" || !protonId || !gameUiOptions().show_protondb) return;
    void withTimeout(getBadge(protonId, false), 9000).then(result => {
      if (mounted) setBadge(result);
    }).catch(() => { if (mounted) setBadge({ tier:"error", url:"", reports:0 }); });
    return () => { mounted = false; };
  }, [protonId, tab]);

  // Steam already has its own functional native Activity / Community tabs.
  // Do not render a second bar on the native Steam page.
  if (!game || !game.shortcut) return null;
  const source = mapping?.client ?? game.source;
  const tabs = gameTabsFor(source);
  const actions = gameCommunityActions(source, mapping?.steam_id ?? null);
  const time = game.playedMinutes === null ? "—" :
    game.playedMinutes < 60 ? Math.round(game.playedMinutes) + " min" :
    (game.playedMinutes / 60).toFixed(1) + " h";
  const lastPlayed = game.lastPlayed ?
    new Date(game.lastPlayed * 1000).toLocaleDateString("pl-PL") : "—";
  function editMapping() {
    if (!game?.shortcut) return;
    const modal = showModal(<SourceMappingDialog game={game}
      initial={{ client: source, steam_id: mapping?.steam_id ?? null }}
      onSave={setAssigned} />);
    void modal.ClosedPromise.catch(() => {});
  }

  return <div data-gamemodehub-game-ui={game.appId}
    style={{display:"flex",flexDirection:"column",gap:8,width:"100%",
      padding:"10px 12px",boxSizing:"border-box"}}>
    <Focusable flow-children="row"
      navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
      style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",
        borderBottom:"1px solid rgba(255,255,255,.2)",paddingBottom:5}}>
      {tabs.map(item => <DialogButton key={item.id}
        preferredFocus={tab===item.id}
        style={{width:"auto",minWidth:0,
          borderBottom:tab===item.id?"2px solid currentColor":"2px solid transparent"}}
        onClick={()=>setTab(item.id)}>
        {item.label}
      </DialogButton>)}
    </Focusable>
    <div role="tabpanel" style={{padding:"5px 6px",fontSize:13,minHeight:55}}>
      {tab==="activity" && <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <strong>Ostatnia aktywność</strong>
        <span>Ostatnio grano: {lastPlayed}</span>
        <span>Czas gry zapisany w SteamOS: {time}</span>
        <span style={{opacity:0.7,fontSize:12}}>
          Inne statystyki i historia sesji należą do obsługującego je launchera.
        </span>
      </div>}
      {tab==="library" && <div style={{display:"flex",flexDirection:"column",gap:7}}>
        <strong>Twoja gra · {label(source)}</strong>
        <span>Uruchamiana jako skrót w bibliotece SteamOS.</span>
        <DialogButton style={{width:"auto",minWidth:0,alignSelf:"flex-start"}}
          onClick={editMapping}>Źródło / ProtonDB</DialogButton>
        <span style={{opacity:0.7,fontSize:12}}>
          Instalowanie, osiągnięcia i zapisy w chmurze pozostają w launcherze
          obsługującym grę, np. Unifideck. Hub nie podmienia jego przycisków.
        </span>
      </div>}
      {tab==="community" && <div style={{display:"flex",flexDirection:"column",gap:7}}>
        <strong>{tabs.find(item=>item.id==="community")?.label}</strong>
        {actions.length ? <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {actions.map(action=><DialogButton key={action.url}
            style={{width:"auto",minWidth:0}}
            onClick={()=>Navigation.NavigateToExternalWeb(action.url)}>
            {action.label}
          </DialogButton>)}
        </Focusable> : <span>Brak dostępnej strony społeczności dla tego launchera.</span>}
        <span style={{fontSize:12,opacity:0.7}}>
          Bez przypisanego identyfikatora gry link może prowadzić do ogólnego forum
          lub pomocy sklepu, nie do strony konkretnej gry.
        </span>
      </div>}
      {tab==="details" && <div style={{display:"flex",flexDirection:"column",gap:7}}>
        <strong>{game.title}</strong>
        <span>Źródło: {label(source)}</span>
        <span>ID skrótu: {game.appId}</span>
        <span>Powiązana gra Steam: {mapping?.steam_id || "brak przypisania"}</span>
        <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <DialogButton style={{width:"auto",minWidth:0}}
            onClick={editMapping}>Źródło / ProtonDB</DialogButton>
          {gameUiOptions().show_protondb && protonId && badge &&
            <DialogButton style={{width:"auto",minWidth:0}}
              disabled={!badge.url}
              onClick={()=>{if(badge.url) Navigation.NavigateToExternalWeb(badge.url);}}>
              ProtonDB: {tierLabel[badge.tier] ?? "Brak oceny"}
            </DialogButton>}
        </Focusable>
      </div>}
    </div>
  </div>;
}

function SourceMappingDialog({ game, initial, onSave, closeModal }: {
  game: UnifiedGame;
  initial: {client:GameSource; steam_id:string|null};
  onSave:(mapping: Mapping)=>void;
  closeModal?:()=>void;
}) {
  const [client, setClient] = useState(initial.client);
  const [steamId, setSteamId] = useState(initial.steam_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = !steamId || (/^[1-9]\d{0,9}$/.test(steamId) && Number(steamId)<0x80000000);
  function choose(anchor: EventTarget) {
    showContextMenu(
      <Menu label="Źródło gry"><MenuGroup label="Launcher">
        {GAME_SOURCES.filter(item=>item.value!=="steam").map(item=>
          <MenuItem key={item.value} selected={item.value===client}
            onSelected={()=>setClient(item.value)}>{item.label}</MenuItem>)}
      </MenuGroup></Menu>, anchor, {bShiftToFitWindow:true});
  }
  async function save() {
    if(!valid || saving) return;
    setSaving(true);setError("");
    try {
      const saved = await withTimeout(setMapping(String(game.appId),client,steamId||null),8000);
      onSave(saved); closeModal?.();
    } catch { setError("Nie zapisano źródła gry."); }
    finally { setSaving(false); }
  }
  return <ModalRoot onCancel={()=>closeModal?.()}>
    <DialogBody><div style={{padding:10,display:"flex",flexDirection:"column",gap:8}}>
      <strong>{game.title} — źródło</strong>
      <DialogButton onClick={event=>choose(event.currentTarget ?? window)}>
        Launcher: {label(client)}
      </DialogButton>
      <div style={{fontSize:12}}>Steam AppID tej samej gry (opcjonalnie). Bez automatycznego zgadywania po tytule.</div>
      <HubTextInput value={steamId} placeholder="Steam AppID do ProtonDB"
        onChange={event=>setSteamId(event.target.value.replace(/\D/g,"").slice(0,10))}/>
      {!valid && <div role="status">Wpisz poprawne Steam AppID gry.</div>}
      {error && <div role="status">{error}</div>}
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{display:"flex",flexDirection:"row",gap:8}}>
        <DialogButton onClick={()=>closeModal?.()}>Anuluj</DialogButton>
        <DialogButton disabled={!valid||saving} onClick={()=>{void save();}}>
          Zapisz
        </DialogButton>
      </Focusable>
    </div></DialogBody>
  </ModalRoot>;
}

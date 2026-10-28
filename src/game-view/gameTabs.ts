/** One four-tab layout for all providers. Store-specific labels and actions. */
import type { GameSource } from "./gameModel";
export type GameTab = "activity" | "library" | "community" | "details";
export type GameTabItem = { id: GameTab; label: string };
export type GameAction = { label: string; url: string };

const labels: Record<GameTab, string> = {
  activity:"Aktywność", library:"Twoje rzeczy", community:"Społeczność",
  details:"Informacje o grze"
};
const alternate: Partial<Record<GameSource, Partial<Record<GameTab,string>>>> = {
  gog:{library:"Moja gra",community:"Forum GOG",details:"O grze"},
  epic:{library:"Moja biblioteka",community:"Pomoc",details:"O grze"},
  amazon:{library:"Moja biblioteka",community:"Pomoc",details:"O grze"},
  ubisoft:{library:"Moja biblioteka",community:"Pomoc",details:"O grze"},
  battlenet:{library:"Moja biblioteka",community:"Pomoc",details:"O grze"},
  xcloud:{library:"Moja biblioteka",community:"Pomoc",details:"O grze"}
};
const links: Partial<Record<GameSource, GameAction>> = {
  gog:{label:"Forum GOG",url:"https://www.gog.com/forum"},
  epic:{label:"Pomoc Epic Games",url:"https://www.epicgames.com/help/"},
  amazon:{label:"Pomoc Amazon Games",url:"https://www.amazongames.com/en-us/support"},
  ubisoft:{label:"Pomoc Ubisoft",url:"https://www.ubisoft.com/en-us/help"},
  battlenet:{label:"Pomoc Battle.net",url:"https://us.battle.net/support/en/"},
  itch:{label:"Społeczność itch.io",url:"https://itch.io/community"},
  xcloud:{label:"Pomoc Xbox",url:"https://support.xbox.com/en-US/"}
};
export function gameTabsFor(source:GameSource): GameTabItem[] {
  return (["activity","library","community","details"] as const).map(id=>({
    id,label:alternate[source]?.[id] || labels[id]
  }));
}
/** Match only explicitly mapped Steam ID; never guess from shortcut title. */
export function gameCommunityActions(source:GameSource,steamId:string|null):GameAction[] {
  const out:GameAction[]=[];
  if(source!=="steam" && links[source]) out.push(links[source]!);
  if(steamId && /^[1-9][0-9]{0,9}$/.test(steamId) && Number(steamId)<0x80000000)
    out.push({label:"Społeczność Steam",url:"https://steamcommunity.com/app/"+steamId+"/"});
  return out;
}

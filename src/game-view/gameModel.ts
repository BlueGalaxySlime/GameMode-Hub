/** Source-neutral game details. This file has no Steam or Decky imports. */
export type GameSource = "steam" | "gog" | "epic" | "heroic" | "lutris" | "bottles" | "amazon" | "ubisoft" | "battlenet" | "itch" | "xcloud" | "external";
export type UnifiedGame = {
  appId: number; title: string; source: GameSource; shortcut: boolean;
  playedMinutes: number | null; lastPlayed: number | null; protonDbAppId: string | null;
};

const SHORTCUT_TYPE = 1073741824;
export const GAME_SOURCES: { value: GameSource; label: string }[] = [
  {value:"steam",label:"Steam"}, {value:"gog",label:"GOG"},
  {value:"epic",label:"Epic"}, {value:"heroic",label:"Heroic"},
  {value:"lutris",label:"Lutris"}, {value:"bottles",label:"Bottles"},
  {value:"amazon",label:"Amazon Games"}, {value:"ubisoft",label:"Ubisoft"},
  {value:"battlenet",label:"Battle.net"}, {value:"itch",label:"itch.io"},
  {value:"xcloud",label:"Xbox Cloud"}, {value:"external",label:"Inny launcher"}
];
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? v as Record<string,unknown> : {};
function numberOrNull(value: unknown) {
  const valueNum = typeof value === "string" || typeof value === "number" ?
    Number(value) : NaN;
  return Number.isFinite(valueNum) && valueNum > 0 ? valueNum : null;
}
export function isShortcut(appId: number, appType: unknown): boolean {
  return appId >= 0x80000000 || appType === SHORTCUT_TYPE;
}
export function detectSource(shortcut: boolean, launchOptions: unknown): GameSource {
  if (!shortcut) return "steam";
  if (typeof launchOptions !== "string") return "external";
  const value = launchOptions.toLowerCase();
  if (/goggalaxy|gogdl|gog:\/\/|(?:^|\s)gog:[^\s]+|--store[= ]gog|--gog/.test(value)) return "gog";
  if (/epicgames|epic:\/\/|(?:^|\s)epic:[^\s]+|--store[= ]epic|--epic/.test(value)) return "epic";
  if (/(?:^|\s)amazon:[^\s]+|--store[= ]amazon|nile/.test(value)) return "amazon";
  if (/(?:^|\s)ubisoft:[^\s]+|uplay:/.test(value)) return "ubisoft";
  if (/(?:^|\s)battlenet:[^\s]+|battle\.net/.test(value)) return "battlenet";
  if (/(?:^|\s)itch:[^\s]+|itch\.io/.test(value)) return "itch";
  if (/(?:^|\s)(?:xcloud|microsoft):[^\s]+/.test(value)) return "xcloud";
  if (value.includes("heroic")) return "heroic";
  if (value.includes("lutris")) return "lutris";
  if (value.includes("bottles")) return "bottles";
  return "external";
}
export function normalizeGame(overview: unknown, details: unknown): UnifiedGame | null {
  const o = object(overview), d = object(details);
  const appId = Number(o.appid ?? 0);
  if (!Number.isInteger(appId) || appId < 1 || appId > 4294967295) return null;
  const shortcut = isShortcut(appId, o.app_type);
  const name = typeof o.display_name === "string" ? o.display_name.trim() : "";
  const minutes = Math.max(numberOrNull(o.minutes_playtime_forever) ?? 0,
                           numberOrNull(d.nPlaytimeForever) ?? 0);
  return {appId, title:name || "Gra", shortcut,
          source:detectSource(shortcut, d.strShortcutLaunchOptions ?? d.strLaunchOptions),
          playedMinutes:minutes || null, lastPlayed:numberOrNull(o.rt_last_time_played),
          protonDbAppId: shortcut ? null : String(appId)};
}

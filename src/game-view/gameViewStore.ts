import { callable } from "@decky/api";

/** UI settings are persisted by the plugin backend. No always-on polling. */
export type GameUiOptions = { enabled: boolean; show_protondb: boolean };
export const DEFAULT_UI: GameUiOptions = { enabled: false, show_protondb: true };
let options: GameUiOptions = DEFAULT_UI;
let loaded = false;
const listeners = new Set<() => void>();
const getRemote = callable<[], GameUiOptions>("game_view_get_options");
const putRemote = callable<[GameUiOptions], GameUiOptions>("game_view_set_options");

export function gameUiOptions() { return options; }
export function subscribeGameUi(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() {
  for (const callback of listeners) callback();
}
export function applyGameUi(next: GameUiOptions) {
  options = {enabled:next.enabled === true, show_protondb:next.show_protondb === true};
  notify();
}
export async function initializeGameUi() {
  if (loaded) return;
  const result = await getRemote();
  loaded = true;
  applyGameUi(result);
}
export async function saveGameUi(next: GameUiOptions) {
  const stored = await putRemote(next);
  applyGameUi(stored);
}

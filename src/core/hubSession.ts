/** Shared state across temporary React unmounts and sidebar tab switches.
 * Platform neutral: the Decky adapter only supplies the UI and persistence.
 * Sessions are held in RAM, not written to disk. No PTYs or processes are kept.
 */
export type HubLanguage = "pl" | "en";
export type HubPreferences = { saveSession: boolean; splitFileTree: boolean; autoKeyboard: boolean; developerMode: boolean; language: HubLanguage };
const defaults: HubPreferences = { saveSession: true, splitFileTree: false, autoKeyboard: true, developerMode: false, language: "pl" };
let preferences = { ...defaults };
const listeners = new Set<() => void>();
const sessions = new Map<string, unknown>();

export function getHubPreferences(): HubPreferences { return preferences; }
export function subscribeHubPreferences(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function applyHubPreferences(value: unknown) {
  if (!value || typeof value !== "object") return preferences;
  const raw = value as Partial<HubPreferences>;
  preferences = {
    saveSession: typeof raw.saveSession === "boolean" ? raw.saveSession : preferences.saveSession,
    splitFileTree: typeof raw.splitFileTree === "boolean" ? raw.splitFileTree : preferences.splitFileTree,
    autoKeyboard: typeof raw.autoKeyboard === "boolean" ? raw.autoKeyboard : preferences.autoKeyboard,
    developerMode: typeof raw.developerMode === "boolean" ? raw.developerMode : preferences.developerMode,
    language: raw.language === "pl" || raw.language === "en" ? raw.language : preferences.language
  };
  if (!preferences.saveSession) sessions.clear();
  listeners.forEach(listener => listener());
  return preferences;
}
export function readHubSession<T>(key: string, fallback: T): T {
  return preferences.saveSession && sessions.has(key)
    ? sessions.get(key) as T : fallback;
}
export function writeHubSession<T>(key: string, value: T) {
  if (preferences.saveSession) sessions.set(key, value);
}
export function clearHubSessions() { sessions.clear(); }

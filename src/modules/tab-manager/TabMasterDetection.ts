/**
 * A plugin directory existing on disk is not proof that a plugin is active.
 * Decky Loader's public hasPlugin method checks the currently loaded plugins;
 * when a plugin is disabled, Decky removes it from that list.
 * https://github.com/SteamDeckHomebrew/decky-loader
 */
export type TabMasterActivity = "active" | "inactive" | "unknown";

export type DeckyLoaderRegistry = {
  hasPlugin(name: string): boolean;
};

export function getTabMasterActivity(
  loader: DeckyLoaderRegistry | null | undefined
): TabMasterActivity {
  if (!loader || typeof loader.hasPlugin !== "function") return "unknown";
  try {
    return loader.hasPlugin("TabMaster") ? "active" : "inactive";
  } catch {
    return "unknown";
  }
}

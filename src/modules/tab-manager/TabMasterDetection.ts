/**
 * Detect actively loaded TabMaster, not just its installation on disk.
 * Some Decky versions expose DeckyPluginLoader.hasPlugin; others expose
 * plugin state via the backend. Unknown is NOT treated as inactive.
 */
export type TabMasterActivity = "active" | "inactive" | "unknown";
export type DeckyLoaderRegistry = {
  hasPlugin?: (name: string) => boolean;
  plugins?: Array<{ name: string }>;
};
type DeckyBackendRegistry = {
  callable?: (method: string) => (...args: unknown[]) => Promise<unknown>;
};

export function getTabMasterActivity(
  loader: DeckyLoaderRegistry | null | undefined
): TabMasterActivity {
  if (!loader) return "unknown";
  try {
    if (typeof loader.hasPlugin === "function")
      return loader.hasPlugin("TabMaster") ? "active" : "inactive";
    if (Array.isArray(loader.plugins))
      return loader.plugins.some(plugin => plugin?.name === "TabMaster") ? "active" : "inactive";
  } catch {
    return "unknown";
  }
  return "unknown";
}

export async function readDeckyTabMasterActivity(
  loader: DeckyLoaderRegistry | null | undefined,
  backend: DeckyBackendRegistry | null | undefined
): Promise<TabMasterActivity> {
  const direct = getTabMasterActivity(loader);
  if (direct !== "unknown") return direct;
  if (typeof backend?.callable !== "function") return "unknown";
  try {
    const response = await backend.callable("loader/get_plugins")();
    if (!Array.isArray(response)) return "unknown";
    // Decky's backend list includes disabled plugins in some versions.
    // A disabled TabMaster is not an active library patch.
    const installed = response.find(item => typeof item === "object" && item !== null &&
      (item as { name?: unknown }).name === "TabMaster") as
      { name: string; disabled?: boolean } | undefined;
    return installed && installed.disabled !== true ? "active" : "inactive";
  } catch {
    return "unknown";
  }
}

/** Pure desktop catalogue filtering: testable without Steam/Decky focus. */
export type DesktopCategory = "all" | "favorites" | "flatpak" | "system" | "hidden";
export type DesktopSort = "recommended" | "name-asc" | "name-desc" | "recent";

export type DesktopAppMeta = { id: string; name: string; flatpak: boolean };
export type DesktopAppPreference = {
  favorite?: boolean; hidden?: boolean; shortcut?: number | null; lastOpened?: number | null;
  category?: "auto" | "flatpak" | "system";
};

export function searchableName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl");
}

export function effectiveDesktopCategory(app: DesktopAppMeta, pref: DesktopAppPreference = {}) {
  if (pref.category === "flatpak" || pref.category === "system") return pref.category;
  return app.flatpak ? "flatpak" : "system";
}

export function filterDesktopApps<T extends DesktopAppMeta>(
  apps: readonly T[],
  stored: Record<string, DesktopAppPreference>,
  category: DesktopCategory,
  search: string,
  sortMode: DesktopSort
): T[] {
  const query = searchableName(search.trim());
  return apps.filter(app => {
    const preferences = stored[app.id] ?? {};
    if (category === "hidden") {
      if (!preferences.hidden) return false;
    } else if (preferences.hidden) {
      return false;
    }
    if (category === "favorites" && !preferences.favorite) return false;
    const effective = effectiveDesktopCategory(app, preferences);
    if (category === "flatpak" && effective !== "flatpak") return false;
    if (category === "system" && effective !== "system") return false;
    return !query || searchableName(app.name).includes(query);
  }).sort((a, b) => {
    const pa = stored[a.id] ?? {};
    const pb = stored[b.id] ?? {};
    if (sortMode === "recommended" && !!pa.favorite !== !!pb.favorite) {
      return pa.favorite ? -1 : 1;
    }
    if (sortMode === "recommended" || sortMode === "recent") {
      const byRecent = (pb.lastOpened ?? 0) - (pa.lastOpened ?? 0);
      if (byRecent) return byRecent;
    }
    const byName = a.name.localeCompare(b.name, "pl");
    return sortMode === "name-desc" ? -byName : byName;
  });
}

/*
 * GameMode Hub Library Integration (GPL-3.0-only).
 * Library interception technique adapted from TabMaster's LibraryPatch.tsx
 * by Travis Lane (Tormak) and contributors:
 * https://github.com/Tormak9970/TabMaster
 * Changes: independent module lifecycle, guarded conflict detection,
 * own tab definitions, custom basic collection filters, native SteamHub tab.
 * See LICENSE and THIRD_PARTY_NOTICES.md.
 */
import { callable, routerHook } from "@decky/api";
import type { RoutePatch } from "@decky/api";
import {
  afterPatch, findInReactTree, gamepadTabbedPageClasses,
  replacePatch, showContextMenu, wrapReactType
} from "@decky/ui";
import type { Patch } from "@decky/ui";
import { createElement, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { getTabMasterActivity, readDeckyTabMasterActivity } from "./TabMasterDetection";
import { LibraryCardsContextMenu } from "./LibraryCardsContextMenu";
import type { TabMasterActivity, DeckyLoaderRegistry } from "./TabMasterDetection";

declare const collectionStore: {
  GetCollection(id: string): any;
};

export type TabFilter = "all" | "installed" | "favorites" | "non_steam" | "collection" | "hub_collection" | "system_tab";
export type TabDefinition = {
  id: string;
  title: string;
  hidden: boolean;
  filter: TabFilter;
  collection_id: string;
};

const readEnabled = callable<[], boolean>("get_tab_manager_enabled");
const readTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const readHiddenSteamTabs = callable<[], string[]>("get_hidden_steam_tabs");
const saveHiddenSteamTabs = callable<[string[]], string[]>("save_hidden_steam_tabs");
type HubCollection = {
  id: string; title: string;
  filter: "manual" | "all" | "installed" | "favorites" | "non_steam";
  app_ids: string[];
};
const readHubCollections = callable<[], HubCollection[]>("get_hub_collections");
/**
 * Checks Decky's currently loaded plugin list, not the plugins installed
 * on disk. TabMaster being disabled is therefore not a conflict.
 */
export function detectTabMasterActivity(): TabMasterActivity {
  const loader = (window as Window & {
    DeckyPluginLoader?: DeckyLoaderRegistry;
  }).DeckyPluginLoader;
  return getTabMasterActivity(loader);
}


let active = false;
let statusDetail: string = "Inicjalizacja";
let conflict = true; // Fail closed until backend checks the other plugin.
let definitions: TabDefinition[] = [];
let hubCollections: HubCollection[] = [];
let hiddenSteamTabs: string[] = [];
let steamTabCatalog: { id: string; title: string }[] = [];
let currentPatch: RoutePatch | undefined;
let renderLibrary: (() => void) | undefined;
let revision = 0;
let generation = 0;

export function tabManagerStatus() {
  return { active, conflict, definitions, statusDetail, patched: !!currentPatch };
}

export async function refreshTabManagerConflict(): Promise<TabMasterActivity> {
  const current = (window as Window & {
    DeckyPluginLoader?: DeckyLoaderRegistry;
    DeckyBackend?: { callable?: (method: string) => (...args: unknown[]) => Promise<unknown> };
  });
  const result = await readDeckyTabMasterActivity(
    current.DeckyPluginLoader, current.DeckyBackend
  );
  conflict = result !== "inactive";
  statusDetail = result === "inactive" ? (active
      ? "Moduł aktywny w bibliotece Steam" : "Moduł kart jest wyłączony w Optymalizacji")
    : result === "active" ? "Aktywny TabMaster blokuje menu Huba"
    : "Decky nie udostępnia stanu innych wtyczek";
  syncPatch();
  return result;
}

export async function startTabManager() {
  const request = ++generation;
  try {
    const [savedEnabled, savedTabs, savedCollections, savedHidden] = await Promise.all([
      readEnabled(), readTabs(), readHubCollections(), readHiddenSteamTabs()
    ]);
    if (request !== generation) return;
    definitions = savedTabs;
    hubCollections = savedCollections;
    hiddenSteamTabs = savedHidden;
    // Honor the user's saved ON/OFF setting at plugin startup.
    // No need to open Optimization after enabling the module once.
    active = savedEnabled;
    await refreshTabManagerConflict();
    if (request !== generation) {
      active = false;
      syncPatch();
    }
  } catch (error) {
    statusDetail = "Błąd odczytu konfiguracji kart";
    console.warn("[GameMode Hub] Tab Manager initialization failed", error);
  }
}

export function stopTabManager() {
  ++generation;
  active = false;
  syncPatch();
}

export function tabManagerEnabledChanged(value: boolean) {
  active = value;
  syncPatch();
}

export function tabManagerConflictChanged(value: boolean) {
  conflict = value;
  syncPatch();
}

/** Original Steam cards remain intact and may only be hidden in Hub's view. */
export function availableSteamLibraryTabs() {
  const hidden = new Set(hiddenSteamTabs);
  return steamTabCatalog.map(tab => ({ ...tab, hidden: hidden.has(tab.id) }));
}

export function hiddenSteamTabsChanged(ids: string[]) {
  hiddenSteamTabs = ids;
  ++revision;
  renderLibrary?.();
}

export async function setSystemTabHidden(id: string, hide: boolean) {
  if (!steamTabCatalog.some(tab => tab.id === id)) {
    throw new Error("Nie znaleziono oryginalnej karty Steam. Otwórz bibliotekę.");
  }
  const next = new Set(hiddenSteamTabs);
  if (hide) next.add(id);
  else next.delete(id);
  if (steamTabCatalog.every(tab => next.has(tab.id))) {
    throw new Error("Co najmniej jedna karta systemowa musi być widoczna.");
  }
  const stored = await saveHiddenSteamTabs([...next]);
  hiddenSteamTabsChanged(stored);
  return stored;
}

export function availableHubCollections(): { id: string; title: string }[] {
  return hubCollections.map(({ id, title }) => ({ id, title }));
}

export function hubCollectionsChanged(value: HubCollection[]) {
  hubCollections = value;
  ++revision;
  renderLibrary?.();
}

export function tabManagerTabsChanged(value: TabDefinition[]) {
  definitions = value;
  ++revision;
  renderLibrary?.();
}

function syncPatch() {
  // A positively detected conflict always wins, even if the previous
  // async check said inactive. An unknown sync result does not erase
  // an earlier confirmed backend check.
  const shouldRun = active && !conflict && detectTabMasterActivity() !== "active";
  if (shouldRun && !currentPatch) {
    try {
      currentPatch = installLibraryPatch();
    } catch (error) {
      console.warn("[SteamHub] Cannot patch library", error);
    }
  } else if (!shouldRun && currentPatch) {
    routerHook.removePatch("/library", currentPatch);
    currentPatch = undefined;
  }
  ++revision;
  renderLibrary?.();
}

type SteamTab = {
  id: string;
  title: string;
  content: ReactElement;
  footer?: Record<string, unknown>;
  renderTabAddon?: () => ReactElement | null;
};

export function availableSteamCollections(): { id: string; title: string }[] {
  if (typeof collectionStore === "undefined") return [];
  try {
    const entries: any[] = (collectionStore as any).userCollections ?? [];
    return entries.filter(item => typeof item?.id === "string").map(item => ({
      id: item.id,
      title: String(item.displayName ?? item.name ?? item.id)
    }));
  } catch { return []; }
}

function sourceCollection(tab: TabDefinition): any {
  if (typeof collectionStore === "undefined") return null;
  let key: string;
  switch (tab.filter) {
    case "installed": key = "local-install"; break;
    case "favorites": key = "favorite"; break;
    case "non_steam": key = "desk-desktop-apps"; break;
    case "collection": key = tab.collection_id; break;
    default: key = "type-games";
  }
  try { return collectionStore.GetCollection(key); }
  catch { return null; }
}

function virtualCollection(tab: TabDefinition) {
  let apps: any[];
  if (tab.filter === "hub_collection") {
    const selected = hubCollections.find(item => item.id === tab.collection_id);
    if (!selected) return null;
    const sourceTab: TabDefinition = { ...tab, filter: selected.filter === "manual" ? "all" : selected.filter };
    const source = sourceCollection(sourceTab);
    if (!source) return null;
    const pool: any[] = Array.from(source.visibleApps ?? source.allApps ?? []);
    if (selected.filter === "manual") {
      const shortcuts = sourceCollection({ ...tab, filter: "non_steam" });
      pool.push(...Array.from(shortcuts?.visibleApps ?? shortcuts?.allApps ?? []));
      const ids = new Set(selected.app_ids);
      apps = pool.filter(app => ids.has(String(app?.appid)));
    } else {
      apps = pool;
    }
  } else {
    const source = sourceCollection(tab);
    if (!source) return null;
    apps = Array.from(source.visibleApps ?? source.allApps ?? []);
  }
  apps = [...new Map(apps.filter(app => app?.appid != null)
    .map(app => [String(app.appid), app])).values()];
  return {
    AsDeletableCollection: () => null,
    AsDragDropCollection: () => null,
    AsEditableCollection: () => null,
    GetAppCountWithToolsFilter: (filter: any) =>
      typeof filter?.Matches === "function" ? apps.filter(app => filter.Matches(app)).length : apps.length,
    bAllowsDragAndDrop: false,
    bIsDeletable: false,
    bIsDynamic: false,
    bIsEditable: false,
    id: "steamhub:" + tab.id,
    displayName: tab.title,
    allApps: apps,
    visibleApps: apps,
    apps: new Map(apps.map(app => [app.appid, app]))
  };
}

function menuFooter(tab: SteamTab): SteamTab {
  return {
    ...tab,
    footer: {
      ...(tab.footer ?? {}),
      onMenuActionDescription: "Karty",
      onMenuButton: () => {
        showContextMenu(createElement(LibraryCardsContextMenu, { selectedTabId: tab.id }));
      }
    }
  };
}

/** Uses Steam's original grid and its built-in Menu button for the focused tab. */
function mergeLibraryTabs(tabs: SteamTab[], deps: any[]): SteamTab[] {
  // Recheck at render time in case TabMaster was enabled after this patch.
  if (!active || conflict || detectTabMasterActivity() === "active") return tabs;
  const template = tabs.find(tab => tab?.id === "AllGames");
  if (!template) return tabs;
  // Snapshot before filtering, so hidden system cards can always be restored.
  steamTabCatalog = tabs.map(({ id, title }) => ({ id, title }));
  // Do not mutate, rename or delete any Steam-owned tab definitions.
  const result = tabs.filter(tab => !hiddenSteamTabs.includes(tab.id)).map(menuFooter);
  const configured = definitions.filter(tab => !tab.hidden);
  if (!configured.length) return result;

  const tabGrid = findInReactTree(
    template.content,
    (node: any) => node?.type && node.type.toString?.().includes("Library_FilteredByHeader")
  )?.type;
  if (!tabGrid) return result;
  const tabContext = (template.content.type as any)?._context;

  const [sortBy, setSortBy, openSortingMenu] = deps;
  for (const tab of configured) {
    if (tab.filter === "system_tab") {
      // A user-owned alias of an original Steam tab: preserve the original
      // content and its filtering behavior instead of approximating it.
      const original = tabs.find(candidate => candidate.id === tab.collection_id);
      if (!original) continue;
      result.push(menuFooter({
        ...original,
        id: "GameModeHub:" + tab.id,
        title: tab.title
      }));
      continue;
    }
    const collection = virtualCollection(tab);
    if (!collection) continue;
    const grid = createElement(tabGrid, {
      collection, eSortBy: sortBy, setSortBy,
      showSortingContextMenu: openSortingMenu
    });
    const content = tabContext
      ? createElement(tabContext.Provider, { value: { label: tab.title } }, grid)
      : grid;
    result.push(menuFooter({
      id: "GameModeHub:" + tab.id,
      title: tab.title,
      content,
      renderTabAddon: () => createElement(
        "span", { className: gamepadTabbedPageClasses.TabCount },
        collection.visibleApps.length
      )
    }));
  }
  return result;
}

/**
 * Patches the SteamOS /library route at the same integration point documented
 * by TabMaster. Uninstalls completely when the module is disabled or conflicting.
 */
function installLibraryPatch(): RoutePatch {
  const patch: RoutePatch = (props: any) => {
    afterPatch(props.children, "type", (_: unknown[], outer: ReactElement) => {
      if (!outer?.type) return outer;
      const [, forceRefresh] = useState(0);
      let innerPatch: Patch | undefined;
      let memoCache: any;

      useEffect(() => {
        const refresh = () => forceRefresh(n => n + 1);
        renderLibrary = refresh;
        return () => {
          if (renderLibrary === refresh) renderLibrary = undefined;
          innerPatch?.unpatch();
        };
      }, []);

      afterPatch(outer, "type", (_: unknown[], inner: ReactElement) => {
        if (!inner?.type) return inner;
        if (memoCache) {
          inner.type = memoCache;
          return inner;
        }
        const original = (inner.type as any)?.type;
        if (typeof original !== "function") return inner;
        wrapReactType(inner);

        innerPatch = replacePatch(inner.type as any, "type", (args: any[]) => {
          const steamReact: any = (window as any).SP_REACT;
          const internals = steamReact?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
          const modern = steamReact?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
          const dispatcher: any = internals?.ReactCurrentDispatcher?.current ??
            (modern && Object.values(modern).find((item: any) => item?.useMemo));
          if (typeof dispatcher?.useMemo !== "function") return original(...args);

          const previous = dispatcher.useMemo;
          const substitute = (fn: () => unknown, deps: any[]) =>
            previous(() => {
              const originalValue: any = fn();
              const nested = Array.isArray(originalValue) && Array.isArray(originalValue[0]);
              const list = nested ? originalValue[0] : originalValue;
              if (!Array.isArray(list) || !list.some((tab: any) => tab?.id === "AllGames")) {
                return originalValue;
              }
              const result = mergeLibraryTabs(list, Array.isArray(deps) ? deps : []);
              return nested ? [result, originalValue[1]] : result;
            }, Array.isArray(deps) ? [...deps, revision] : deps);

          try {
            dispatcher.useMemo = substitute;
            return original(...args);
          } finally {
            dispatcher.useMemo = previous;
          }
        });
        memoCache = inner.type;
        return inner;
      });
      return outer;
    });
    return props;
  };
  return routerHook.addPatch("/library", patch);
}

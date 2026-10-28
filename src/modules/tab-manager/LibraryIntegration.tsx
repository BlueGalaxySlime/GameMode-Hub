/*
 * SteamHub Library Integration (GPL-3.0-only).
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
  replacePatch, wrapReactType
} from "@decky/ui";
import type { Patch } from "@decky/ui";
import { createElement, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { getTabMasterActivity } from "./TabMasterDetection";
import type { TabMasterActivity, DeckyLoaderRegistry } from "./TabMasterDetection";

declare const collectionStore: {
  GetCollection(id: string): any;
};

export type TabFilter = "all" | "installed" | "favorites" | "non_steam" | "collection";
export type TabDefinition = {
  id: string;
  title: string;
  hidden: boolean;
  filter: TabFilter;
  collection_id: string;
};

const readEnabled = callable<[], boolean>("get_tab_manager_enabled");
const readTabs = callable<[], TabDefinition[]>("get_tab_definitions");
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
let conflict = true; // Fail closed until backend checks the other plugin.
let definitions: TabDefinition[] = [];
let currentPatch: RoutePatch | undefined;
let renderLibrary: (() => void) | undefined;
let revision = 0;
let generation = 0;

export function tabManagerStatus() {
  return { active, conflict, definitions };
}

export async function startTabManager() {
  const request = ++generation;
  try {
    const [savedEnabled, savedTabs] = await Promise.all([
      readEnabled(), readTabs()
    ]);
    if (request !== generation) return;
    active = savedEnabled;
    // Fail closed only when Decky's active-plugin state is unknown or active.
    conflict = detectTabMasterActivity() !== "inactive";
    definitions = savedTabs;
    syncPatch();
  } catch (error) {
    console.warn("[SteamHub] Tab Manager initialization failed", error);
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

export function tabManagerTabsChanged(value: TabDefinition[]) {
  definitions = value;
  ++revision;
  renderLibrary?.();
}

function syncPatch() {
  const shouldRun = active && !conflict && detectTabMasterActivity() === "inactive";
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
  const source = sourceCollection(tab);
  if (!source) return null;
  const apps: any[] = Array.from(source.visibleApps ?? source.allApps ?? []);
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

function nativeHubTab(): SteamTab {
  return {
    id: "SteamHub",
    title: "SteamHub",
    content: <div style={{ padding: "24px", maxWidth: "860px" }}>
      <h2>SteamHub</h2>
      <p>Zarządzanie modułami SteamHub jest dostępne w menu Decky.</p>
      <p>Tab Manager · Biblioteka SteamOS</p>
    </div>,
    renderTabAddon: () => null
  };
}

/** Uses Steam's original grid component rather than constructing a separate collection tab. */
function mergeLibraryTabs(tabs: SteamTab[], deps: any[]): SteamTab[] {
  // Recheck at render time in case TabMaster was enabled after this patch.
  if (!active || conflict || detectTabMasterActivity() !== "inactive") return tabs;
  const template = tabs.find(tab => tab?.id === "AllGames");
  if (!template) return tabs;
  // Never replace Steam's own tabs or objects; TabManager only appends additions.
  const result = [...tabs];
  if (!result.some(tab => tab.id === "SteamHub")) result.push(nativeHubTab());

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
    const collection = virtualCollection(tab);
    if (!collection) continue;
    const grid = createElement(tabGrid, {
      collection, eSortBy: sortBy, setSortBy,
      showSortingContextMenu: openSortingMenu
    });
    const content = tabContext
      ? createElement(tabContext.Provider, { value: { label: tab.title } }, grid)
      : grid;
    result.push({
      id: "SteamHub:" + tab.id,
      title: tab.title,
      content,
      renderTabAddon: () => createElement(
        "span", { className: gamepadTabbedPageClasses.TabCount },
        collection.visibleApps.length
      )
    });
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

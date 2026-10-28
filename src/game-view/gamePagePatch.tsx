import { routerHook } from "@decky/api";
import type { RoutePatch } from "@decky/api";
import { afterPatch, appDetailsClasses, createReactTreePatcher, findInReactTree } from "@decky/ui";
import type { ReactElement } from "react";
import { UnifiedGameStrip } from "./UnifiedGameStrip";
import { gameUiOptions, subscribeGameUi } from "./gameViewStore";

const ROUTE = "/library/app/:appid";
const KEY = "gamemodehub-unified-game-strip";
let installed: RoutePatch | null = null;

/** Additive and fail-closed SteamOS route patch.
 * Technique informed by Game Glance (Michael Palma, MIT) and HLTB for Deck.
 * Does not replace native Play/Update widgets or rewrite Steam CSS.
 */
function install(): RoutePatch {
  return routerHook.addPatch(ROUTE, (routeTree: any) => {
    try {
      const route = findInReactTree(routeTree, (item: any) => item?.renderFunc);
      if (!route) return routeTree;
      let overview: unknown;
      let details: unknown;
      const patcher = createReactTreePatcher(
        [(tree: any) => {
          const entry = findInReactTree(tree, (item: any) =>
            item?.props?.children?.props?.overview)?.props?.children;
          if (!entry) return null;
          overview = entry.props.overview;
          details = entry.props.details;
          return entry;
        }],
        (_: Record<string,unknown>[], rendered: ReactElement) => {
          try {
            if (!gameUiOptions().enabled || !appDetailsClasses?.InnerContainer) return rendered;
            const children = findInReactTree(rendered, (item:any)=>
              Array.isArray(item?.props?.children) &&
              typeof item?.props?.className === "string" &&
              item.props.className.includes(appDetailsClasses.InnerContainer)
            )?.props?.children as any[] | undefined;
            if (!children || children.some(item=>item?.key===KEY)) return rendered;
            const anchor = children.findIndex(child =>
              child?.props?.childFocusDisabled !== undefined &&
              child?.props?.navRef !== undefined &&
              child?.props?.children?.props?.overview !== undefined &&
              child?.props?.children?.props?.details !== undefined
            );
            if (anchor<0) return rendered;
            children.splice(anchor,0,
              <UnifiedGameStrip key={KEY} overview={overview} details={details}/>);
          } catch(error) {
            console.warn("[GameMode Hub] Game UI patch skipped",error);
          }
          return rendered;
        }
      );
      afterPatch(route,"renderFunc",patcher);
    } catch(error) {
      console.warn("[GameMode Hub] Game UI route patch skipped",error);
    }
    return routeTree;
  });
}

export function startUnifiedGameUi(): () => void {
  function sync() {
    const enabled = gameUiOptions().enabled;
    if (enabled && !installed) {
      try { installed = install(); }
      catch(error) { console.warn("[GameMode Hub] Cannot attach game view",error); }
    } else if (!enabled && installed) {
      try { routerHook.removePatch(ROUTE,installed); } finally { installed=null; }
    }
  }
  const unsubscribe = subscribeGameUi(sync);
  sync();
  return () => {
    unsubscribe();
    if (installed) {
      try { routerHook.removePatch(ROUTE,installed); } finally { installed=null; }
    }
  };
}

import { routerHook } from "@decky/api";
import type { RoutePatch } from "@decky/api";
import { afterPatch, appDetailsClasses, appDetailsHeaderClasses, playSectionClasses, createReactTreePatcher, findInReactTree } from "@decky/ui";
import type { ReactElement } from "react";
import { UnifiedGameStrip } from "./UnifiedGameStrip";
import { gameUiOptions, subscribeGameUi } from "./gameViewStore";

const ROUTE = "/library/app/:appid";
const KEY = "gamemodehub-unified-game-tabs";
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
            const appId = Number((overview as {appid?:number}|undefined)?.appid);
            if (!Number.isInteger(appId) || appId < 0x80000000) return rendered;
            const children = findInReactTree(rendered, (item:any)=>
              Array.isArray(item?.props?.children) &&
              typeof item?.props?.className === "string" &&
              item.props.className.includes(appDetailsClasses.InnerContainer)
            )?.props?.children as any[] | undefined;
            if (!children || children.some(item=>item?.key===KEY)) return rendered;
            // Coexist with Unifideck: keep its install/achievements/cloud
            // controls and insert behind its info panel if already present.
            const unifideckInfo = children.findIndex(child =>
              typeof child?.key === "string" &&
              child.key.startsWith("unifideck-game-info-"));
            const unifideckPlay = children.findIndex(child =>
              typeof child?.key === "string" &&
              child.key.startsWith("unifideck-play-wrapper-"));
            const header = children.findIndex(child => {
              const cls = String(child?.props?.className ?? "");
              return Boolean(
                (playSectionClasses?.Container && cls.includes(playSectionClasses.Container)) ||
                (appDetailsHeaderClasses?.TopCapsule && cls.includes(appDetailsHeaderClasses.TopCapsule)) ||
                (appDetailsClasses?.Header && cls.includes(appDetailsClasses.Header))
              );
            });
            const anchor = unifideckInfo >= 0 ? unifideckInfo + 1 :
              unifideckPlay >= 0 ? unifideckPlay + 1 :
              header >= 0 ? header + 1 : -1;
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

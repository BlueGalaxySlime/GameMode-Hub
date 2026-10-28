import { Component, useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { FaTools } from "react-icons/fa";
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { HubPage } from "./hub/HubPage";
import { DownloadsPage } from "./hub/DownloadsPage";
import { useDownloads } from "./hub/downloads";
import { closeHubView, getHubRevision, openHubRecoveryMenu,
  refreshHubView, subscribeHubRevision } from "./hub/hubRecovery";
import { APP_NAME, DECKY_PLUGIN_NAME, HUB_ROUTE } from "./core/identity";

class HubErrorBoundary extends Component<{ resetKey: number; children: ReactNode },
    { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ resetKey: number; children: ReactNode }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }
  render() {
    if (this.state.failed) {
      return <div style={{ padding: 12 }}>
        <p>Interfejs Huba napotkał błąd. Pobieranie w tle nie zostało zatrzymane.</p>
        <ButtonItem onClick={refreshHubView}>Odśwież interfejs Huba</ButtonItem>
        <ButtonItem onClick={closeHubView}>Zamknij Hub</ButtonItem>
      </div>;
    }
    return this.props.children;
  }
}

function HubHost() {
  const revision = useSyncExternalStore(
    subscribeHubRevision, getHubRevision, getHubRevision
  );
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      // Some devices map their menu key to '='. SteamOS may consume it before
      // the plugin receives the event; Decky sidebar is the reliable fallback.
      if (event.key !== "=" && event.key !== "ContextMenu") return;
      if (event.repeat || event.defaultPrevented) return;
      const element = document.activeElement;
      if (element instanceof HTMLElement &&
          (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openHubRecoveryMenu(element || document.body);
    }
    window.addEventListener("keydown", keyDown, true);
    return () => window.removeEventListener("keydown", keyDown, true);
  }, []);
  return <HubErrorBoundary resetKey={revision}>
    <HubPage key={revision} />
  </HubErrorBoundary>;
}

function openHub() {
  Navigation.Navigate(HUB_ROUTE);
  Navigation.CloseSideMenus();
}

function openDownloads() {
  Navigation.Navigate(HUB_ROUTE + "/downloads");
  Navigation.CloseSideMenus();
}

function QuickAccessContent() {
  const { jobs, active, error } = useDownloads(2400);
  return <>
    <PanelSection>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={openHub}>Otwórz {APP_NAME}</ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={refreshHubView}>
          Odśwież interfejs Huba
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={closeHubView}>
          Zamknij Hub
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
    <PanelSection title="Pobieranie">
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={openDownloads}>
          {error ? "Pobieranie niedostępne" :
            active ? "Pobieranie: " + active + " aktywne" :
            jobs.length ? "Ostatnie: " + jobs[0].label : "Brak pobierania"}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  </>;
}

export default definePlugin(() => {
  routerHook.addRoute(HUB_ROUTE, () => <HubHost />);
  routerHook.addRoute(HUB_ROUTE + "/downloads", () => <DownloadsPage />);
  return {
    name: DECKY_PLUGIN_NAME,
    titleView: <div className={staticClasses.Title}>{APP_NAME}</div>,
    content: <QuickAccessContent />,
    icon: <FaTools />,
    onDismount: () => {
      routerHook.removeRoute(HUB_ROUTE + "/downloads");
      routerHook.removeRoute(HUB_ROUTE);
    }
  };
});

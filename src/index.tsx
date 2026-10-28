import { FaTools } from "react-icons/fa";
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { HubPage } from "./hub/HubPage";
import { DownloadsPage } from "./hub/DownloadsPage";
import { useDownloads } from "./hub/downloads";
import { APP_NAME, DECKY_PLUGIN_NAME, HUB_ROUTE } from "./core/identity";

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
  routerHook.addRoute(HUB_ROUTE, () => <HubPage />);
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

import { FaTools } from "react-icons/fa";
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { HubPage } from "./hub/HubPage";
import { APP_NAME, DECKY_PLUGIN_NAME, HUB_ROUTE } from "./core/identity";

function openHub() {
  Navigation.Navigate(HUB_ROUTE);
  Navigation.CloseSideMenus();
}

function QuickAccessContent() {
  return <PanelSection>
    <PanelSectionRow>
      <ButtonItem layout="below" onClick={openHub}>Otwórz {APP_NAME}</ButtonItem>
    </PanelSectionRow>
  </PanelSection>;
}

export default definePlugin(() => {
  routerHook.addRoute(HUB_ROUTE, () => <HubPage />);
  return {
    name: DECKY_PLUGIN_NAME,
    titleView: <div className={staticClasses.Title}>{APP_NAME}</div>,
    content: <QuickAccessContent />,
    icon: <FaTools />,
    onDismount: () => { routerHook.removeRoute(HUB_ROUTE); }
  };
});

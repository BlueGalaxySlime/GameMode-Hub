import { FaTools } from "react-icons/fa";
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { HubPage } from "./hub/HubPage";

const HUB_ROUTE = "/steamhub";

function openHub() {
  Navigation.Navigate(HUB_ROUTE);
  Navigation.CloseSideMenus();
}

function QuickAccessContent() {
  return <PanelSection>
    <PanelSectionRow>
      <ButtonItem layout="below" onClick={openHub}>Otwórz GameMode Hub</ButtonItem>
    </PanelSectionRow>
  </PanelSection>;
}

export default definePlugin(() => {
  routerHook.addRoute(HUB_ROUTE, () => <HubPage />);
  return {
    name: "GameMode Hub",
    titleView: <div className={staticClasses.Title}>GameMode Hub</div>,
    content: <QuickAccessContent />,
    icon: <FaTools />,
    onDismount: () => { routerHook.removeRoute(HUB_ROUTE); }
  };
});

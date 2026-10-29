import { useEffect } from "react";
import { callable } from "@decky/api";
import { SidebarNavigation } from "@decky/ui";
import {
  FaCog, FaFolderOpen, FaHeart, FaHome, FaPuzzlePiece, FaSyncAlt,
  FaTerminal, FaUserCircle, FaBug, FaDownload, FaTv
} from "react-icons/fa";
import { UpdatesPage } from "./UpdatesPage";
import { FileManagerPage } from "./FileManagerPage";
import { DesktopPage } from "./DesktopPage";
import { AccountsPage } from "./AccountsPage";
import { HubOptionsPage, initializeHubOptions } from "./HubOptionsPage";
import { useHubSessionState } from "./useHubSessionState";
import { DeckyTerminalPage } from "./DeckyTerminalAdapter";
import { CreditsPage } from "./CreditsPage";
import { ReportsPage } from "./ReportsPage";
import { UiPage } from "./UiPage";
import { DownloadsPage } from "./DownloadsPage";
import { HubAddonsPage } from "./HubAddonsPage";
import { HUB_ROUTE } from "../core/identity";
import { CORE_MODULES } from "../core/modules";

const setUiOpen = callable<[boolean], { ok: boolean }>("hub_ui_open");

export function HubPage() {
  const [terminalFontSize, setTerminalFontSize] = useHubSessionState("terminal.fontSize", 15);

  useEffect(() => {
    void setUiOpen(true).catch(() => {});
    return () => { void setUiOpen(false).catch(() => {}); };
  }, []);
  useEffect(() => { void initializeHubOptions().catch(() => {}); }, []);

  // Only first-party Hub modules belong to this sidebar. Other Decky plugins
  // retain their own panels; Dodatki now lists explicitly related dependencies.
  const registered = CORE_MODULES.map(module => module.id);
  const pages = [
    { title: "Pulpit", route: HUB_ROUTE + "/home", icon: <FaHome />,
      content: <DesktopPage /> },
    { title: "Pliki", route: HUB_ROUTE + "/files", icon: <FaFolderOpen />,
      content: <FileManagerPage /> },
    { title: "Terminal", route: HUB_ROUTE + "/terminal", icon: <FaTerminal />,
      hideTitle: true, padding: "none" as const,
      content: <DeckyTerminalPage fontSize={terminalFontSize} /> },
    { title: "Konta", route: HUB_ROUTE + "/accounts", icon: <FaUserCircle />,
      content: <AccountsPage /> },
    { title: "Opcje Huba", route: HUB_ROUTE + "/options", icon: <FaCog />,
      content: <HubOptionsPage terminalFontSize={terminalFontSize}
        setTerminalFontSize={setTerminalFontSize} /> },
    { title: "Aktualizacje", route: HUB_ROUTE + "/updates", icon: <FaSyncAlt />,
      content: <UpdatesPage /> },
    { title: "Pobieranie", route: HUB_ROUTE + "/downloads", icon: <FaDownload />,
      content: <DownloadsPage /> },
    { title: "Optymalizacja", route: HUB_ROUTE + "/ui", icon: <FaTv />,
      content: <UiPage /> },
    { title: "Podziękowania", route: HUB_ROUTE + "/credits", icon: <FaHeart />,
      content: <CreditsPage /> },
    { title: "Zgłoszenia", route: HUB_ROUTE + "/reports", icon: <FaBug />,
      content: <ReportsPage /> },
    { title: "Dodatki", route: HUB_ROUTE + "/addons", icon: <FaPuzzlePiece />,
      content: <HubAddonsPage /> }
  ];
  if (!registered.includes("home")) return null;
  return <SidebarNavigation pages={pages} />;
}

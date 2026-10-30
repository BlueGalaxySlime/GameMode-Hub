import { useEffect, useRef, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import { SidebarNavigation } from "@decky/ui";
import {
  FaCog, FaFolderOpen, FaHeart, FaHome, FaPuzzlePiece, FaSyncAlt,
  FaTerminal, FaUserCircle, FaBug, FaDownload, FaTv, FaQuestionCircle
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
import { HelpPage } from "./HelpPage";
import { HUB_ROUTE } from "../core/identity";
import { CORE_MODULES } from "../core/modules";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
import { enableHubScroll } from "./hubScroll";

const setUiOpen = callable<[boolean], { ok: boolean }>("hub_ui_open");
const NAV_EN: Record<string, string> = {
  "Pulpit": "Desktop", "Pliki": "Files", "Terminal": "Terminal",
  "Konta": "Accounts", "Opcje Huba": "Hub Options",
  "Aktualizacje": "Updates", "Pobieranie": "Downloads",
  "Optymalizacja": "Optimization", "Podziękowania": "Credits",
  "Zgłoszenia": "Reports", "Dodatki": "Add-ons", "Pomoc": "Help"
};

export function HubPage() {
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = shellRef.current;
    return shell ? enableHubScroll(shell) : undefined;
  }, []);
  const language = useSyncExternalStore(subscribeHubPreferences, getHubPreferences).language;
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
      content: <HubAddonsPage /> },
    { title: "Pomoc", route: HUB_ROUTE + "/help", icon: <FaQuestionCircle />,
      content: <HelpPage /> }
  ];
  if (!registered.includes("home")) return null;
  // The shell does not affect Steam's flex layout. Route wrappers mark only
  // Hub content: right-trackpad wheel scrolling never changes sidebar focus.
  const routedPages = (language === "en"
    ? pages.map(page => ({ ...page, title: NAV_EN[page.title] ?? page.title }))
    : pages).map(page => ({
      ...page,
      content: <div data-hub-scroll-page={page.route}
        style={{ width: "100%", minWidth: 0 }}>{page.content}</div>
    }));
  return <div ref={shellRef} data-hub-shell style={{ display: "contents" }}>
    <SidebarNavigation pages={routedPages} />
  </div>;
}

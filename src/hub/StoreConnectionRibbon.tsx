import { FaSteam } from "react-icons/fa";
import { SiGogdotcom, SiEpicgames } from "react-icons/si";
import type { IconType } from "react-icons";

export type ConnectionState = "connected" | "disconnected" | "unknown";

type Store = { id: "steam" | "gog" | "epic"; title: string; Icon: IconType };
const STORES: readonly Store[] = [
  { id: "steam", title: "Steam", Icon: FaSteam },
  { id: "gog", title: "GOG", Icon: SiGogdotcom },
  { id: "epic", title: "Epic Games", Icon: SiEpicgames }
];

const COLORS: Record<ConnectionState, string> = {
  connected: "#4caf50",
  disconnected: "var(--gpStoreLightGrey, #999)",
  unknown: "var(--gpStoreLightGrey, #999)"
};

/**
 * Read-only status ribbon. Same react-icons store glyphs as Unifideck's
 * StoreIcon mapping, no Unifideck runtime dependency.
 * Icons cannot trigger selection, login or a session refresh.
 */
export function StoreConnectionRibbon({ states, language = "pl" }: {
  states: Record<Store["id"], ConnectionState>;
  language?: "pl" | "en";
}) {
  const descriptions = language === "en"
    ? { connected: "Connected", disconnected: "Not connected", unknown: "Not verified" }
    : { connected: "Połączone", disconnected: "Niepołączone", unknown: "Niezweryfikowane" };
  return <div role="group"
    aria-label={language === "en" ? "Store connections (read only)" : "Połączenia sklepów (podgląd)"}
    style={{ display: "flex", alignItems: "stretch", gap: 10, padding: "8px 0",
      flexWrap: "nowrap", overflowX: "auto", maxWidth: "100%" }}>
    {STORES.map(({ id, title, Icon }) => {
      const state = states[id];
      return <div key={id}
        aria-label={title + " — " + descriptions[state]}
        title={title + " — " + descriptions[state]}
        style={{ display: "flex", alignItems: "center", flexDirection: "column",
          minWidth: 74, flex: "1 0 74px", gap: 5, padding: "8px 4px",
          border: "1px solid var(--gpStoreLightGrey, #777)",
          borderRadius: 0, opacity: state === "disconnected" ? 0.67 : 1 }}>
        <Icon size={22} color={COLORS[state]} aria-hidden="true" />
        <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ fontSize: 10, color: state === "connected" ? COLORS.connected : "inherit",
          whiteSpace: "nowrap" }}>{descriptions[state]}</span>
      </div>;
    })}
  </div>;
}

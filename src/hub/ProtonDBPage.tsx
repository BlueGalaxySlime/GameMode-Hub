import { useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Focusable, Menu, MenuGroup,
  MenuItem, Navigation, NavEntryPositionPreferences, showContextMenu
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { HubTextInput } from "./HubTextInput";
import { useHubSessionState } from "./useHubSessionState";

type Client = "auto" | "steam" | "heroic" | "lutris" | "bottles";
type BadgeResult = {
  app_id: string; tier: string; reports: number; checked_at: number;
  cached: boolean; url: string;
};
const getBadge = callable<[string, boolean], BadgeResult>("protondb_get_badge");
const CLIENTS: { id: Client; label: string }[] = [
  { id: "auto", label: "Auto (aktualnie SteamOS)" },
  { id: "steam", label: "Steam" },
  { id: "heroic", label: "Heroic" },
  { id: "lutris", label: "Lutris" },
  { id: "bottles", label: "Bottles" }
];
const TIERS: Record<string, string> = {
  platinum: "Platinum", gold: "Gold", silver: "Silver",
  bronze: "Bronze", borked: "Borked", native: "Native",
  pending: "Pending", unrated: "Brak raportów", error: "Brak połączenia"
};

/**
 * Cross-client data adapter: clients all map to a Steam AppID.
 * Heroic/Lutris/Bottles cannot currently be matched to a Steam game without
 * their own provider adapters, so manual AppID remains explicitly required.
 * No intrusive Steam detail/library patches before device testing.
 */
export function ProtonDBPage() {
  const [client, setClient] = useHubSessionState<Client>("protondb.client", "auto");
  const [appId, setAppId] = useHubSessionState("protondb.appId", "");
  const [result, setResult] = useState<BadgeResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const valid = /^[1-9][0-9]{0,9}$/.test(appId) && Number(appId) <= 4294967295;

  function openClientMenu(anchor: EventTarget) {
    showContextMenu(
      <Menu label="Klient gier">
        <MenuGroup label="Źródło gry">
          {CLIENTS.map(item => <MenuItem key={item.id} selected={client === item.id}
            onSelected={() => setClient(item.id)}>{item.label}</MenuItem>)}
        </MenuGroup>
      </Menu>, anchor, { bShiftToFitWindow: true }
    );
  }

  async function check(force = false) {
    if (working || !valid) return;
    setWorking(true);
    setError("");
    try {
      const next = await withTimeout(getBadge(appId, force), 10000);
      setResult(next);
    } catch {
      setError("Nie można pobrać odznaki. Spróbuj ponownie lub sprawdź AppID.");
    } finally { setWorking(false); }
  }

  return <DialogBody><DialogControlsSection>
    <Focusable flow-children="column" style={{
      display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
      padding: "4px 0"
    }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Oceny zgodności z Linux / Proton. Moduł nie działa podczas grania,
        dopóki nie sprawdzisz wybranej gry.
      </div>
      <DialogButton onClick={event => openClientMenu(event.currentTarget ?? window)}>
        Klient: {CLIENTS.find(item => item.id === client)?.label ?? "Auto"}
      </DialogButton>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        {client === "auto" || client === "steam"
          ? "Auto rozpoznaje środowisko SteamOS. Podaj Steam AppID gry."
          : "Ten klient wymaga obecnie ręcznego Steam AppID; automatyczne mapowanie gier będzie osobnym adapterem."}
      </div>
      <HubTextInput value={appId} aria-label="Steam AppID"
        placeholder="Steam AppID (np. 620)"
        onChange={event => { setAppId(event.target.value.replace(/\D/g, "").slice(0, 10)); setResult(null); }}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void check(); } }} />
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        <DialogButton disabled={working || !valid} onClick={() => { void check(); }}>
          {working ? "Sprawdzanie…" : "Pokaż odznakę"}
        </DialogButton>
        <DialogButton disabled={working || !valid} onClick={() => { void check(true); }}>
          Odśwież ocenę
        </DialogButton>
      </Focusable>
      {error && <div role="status">{error}</div>}
      {result && result.app_id === appId && <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <strong>ProtonDB · {TIERS[result.tier] || "Brak oceny"}</strong>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Raporty: {result.reports} · Sprawdzono: {new Date(result.checked_at * 1000).toLocaleString("pl-PL")}
          {result.cached ? " · z pamięci podręcznej" : ""}
        </div>
        <DialogButton onClick={() => Navigation.NavigateToExternalWeb(result.url)}>
          Otwórz raporty ProtonDB
        </DialogButton>
      </div>}
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Źródło: ProtonDB (ODbL/DbCL). Bez tokenów, własnej bramki i
        skanowania biblioteki. Nakładki odznak na kartach Steam oraz integracje
        klientów zewnętrznych wymagają osobnych, przetestowanych adapterów.
      </div>
    </Focusable>
  </DialogControlsSection></DialogBody>;
}

import { useState } from "react";
import { FaTools } from "react-icons/fa";
import { ButtonItem, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { callable, definePlugin } from "@decky/api";

type UpdateResult = {
  current: string; latest: string | null; url: string | null; sha256: string | null;
  available: boolean; status: "ok" | "no_releases" | "error"; error?: string | null;
};
type DeckyInstaller = {
  callable: (method: string) => (...args: unknown[]) => Promise<unknown>;
};
const checkUpdates = callable<[], UpdateResult>("check_updates");
const VERSION = "0.2.0";

function Content() {
  const [message, setMessage] = useState("Nie sprawdzono aktualizacji.");
  const [release, setRelease] = useState<UpdateResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setRelease(null);
    try {
      const result = await checkUpdates();
      if (result.status === "no_releases") setMessage(result.error || "Brak opublikowanych wydań GitHub Releases.");
      else if (result.status === "error") setMessage(result.error || "Nie udało się sprawdzić aktualizacji.");
      else if (result.available) {
        setRelease(result);
        setMessage("Dostępna wersja " + result.latest + ". Możesz ją zainstalować.");
      } else if (result.latest && result.latest !== VERSION) {
        setMessage("Wydanie " + result.latest + " nie jest nowsze lub nie ma paczki z sumą SHA-256.");
      } else setMessage("SteamHub jest aktualny (" + VERSION + ").");
    } catch (error) {
      setMessage("Błąd komunikacji z wtyczką: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!release?.available || !release.url || !release.sha256 || !release.latest) return;
    const backend = (window as Window & { DeckyBackend?: DeckyInstaller }).DeckyBackend;
    if (!backend || typeof backend.callable !== "function") {
      setMessage("Ta wersja Decky nie udostępnia instalatora. Użyj Decky → Developer → Install Plugin from URL.");
      return;
    }
    setBusy(true);
    setMessage("Przekazuję aktualizację do Decky Loader…");
    try {
      await backend.callable("utilities/install_plugin")(release.url, "SteamHub", release.latest, release.sha256, 2);
      setMessage("Aktualizacja przekazana do Decky Loader.");
    } catch {
      setMessage("Decky nie zainstalował aktualizacji. Sprawdź wersję Decky Loader.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PanelSection title="SteamHub · 0.2.0">
      <PanelSectionRow><div>Wersja demonstracyjna. Moduły będą dodawane stopniowo.</div></PanelSectionRow>
    </PanelSection>
    <PanelSection title="Moduły (w przygotowaniu)">
      <PanelSectionRow><div>Game Manager · Library Manager · Terminal</div></PanelSectionRow>
    </PanelSection>
    <PanelSection title="Aktualizacje">
      <PanelSectionRow><div>{message}</div></PanelSectionRow>
      <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={check}>{busy ? "Czekaj…" : "Sprawdź aktualizacje"}</ButtonItem></PanelSectionRow>
      {release?.available && <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={install}>Aktualizuj do {release.latest}</ButtonItem></PanelSectionRow>}
    </PanelSection>
  </>;
}

export default definePlugin(() => ({
  name: "SteamHub",
  titleView: <div className={staticClasses.Title}>SteamHub</div>,
  content: <Content />,
  icon: <FaTools />,
}));

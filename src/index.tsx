import { useState } from "react";
import { FaTools } from "react-icons/fa";
import { ButtonItem, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { callable, definePlugin } from "@decky/api";

type UpdateResult = { current: string; latest: string | null; url: string | null; status: "ok" | "no_releases" | "error" };
const checkUpdates = callable<[], UpdateResult>("check_updates");
const VERSION = "0.1.0";

function Content() {
  const [message, setMessage] = useState("Nie sprawdzono aktualizacji.");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const result = await checkUpdates();
      if (result.status === "no_releases") setMessage("Brak opublikowanych wydań GitHub Releases.");
      else if (result.status === "error") setMessage("Nie udało się sprawdzić aktualizacji.");
      else if (result.latest === VERSION || result.latest === "v" + VERSION) setMessage("Masz najnowszą wersję: " + VERSION);
      else setMessage("Najnowsze wydanie: " + result.latest + ". Sprawdź GitHub Releases przed aktualizacją.");
    } catch { setMessage("Błąd komunikacji z wtyczką."); }
    finally { setBusy(false); }
  }
  return <>
    <PanelSection title="SteamOS-Hub · 0.1.0">
      <PanelSectionRow><div>Wersja demonstracyjna. Moduły będą dodawane stopniowo.</div></PanelSectionRow>
    </PanelSection>
    <PanelSection title="Moduły (w przygotowaniu)">
      <PanelSectionRow><div>Game Manager · Library Manager · Terminal</div></PanelSectionRow>
    </PanelSection>
    <PanelSection title="Aktualizacje">
      <PanelSectionRow><div>{message}</div></PanelSectionRow>
      <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={check}>{busy ? "Sprawdzanie…" : "Sprawdź aktualizacje"}</ButtonItem></PanelSectionRow>
    </PanelSection>
  </>;
}

export default definePlugin(() => ({
  name: "SteamOS-Hub",
  titleView: <div className={staticClasses.Title}>SteamOS-Hub</div>,
  content: <Content />,
  icon: <FaTools />,
}));

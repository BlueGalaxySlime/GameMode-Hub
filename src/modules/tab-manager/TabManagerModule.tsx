import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Field, Menu, MenuItem, Navigation, showContextMenu
} from "@decky/ui";
import type { TabDefinition } from "./LibraryIntegration";
import {
  tabManagerTabsChanged, refreshTabManagerConflict, tabManagerStatus,
  availableSteamLibraryTabs, setSystemTabHidden
} from "./LibraryIntegration";
import type { TabMasterActivity } from "./TabMasterDetection";

const readTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const saveTabs = callable<[TabDefinition[]], TabDefinition[]>("save_tab_definitions");

/** Only options here. Card editing lives on Steam's library tabs via Menu. */
export function TabManagerModule() {
  const [activity, setActivity] = useState<TabMasterActivity>("unknown");
  const [tabs, setTabs] = useState<TabDefinition[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([readTabs(), refreshTabManagerConflict()]).then(([definitions, status]) => {
      if (!alive) return;
      setTabs(definitions);
      setActivity(status);
    }).catch(() => {
      if (alive) setError("Nie udało się sprawdzić integracji kart w Steam.");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  async function manage() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const status = await refreshTabManagerConflict();
      setActivity(status);
      if (status !== "inactive") {
        setError(status === "active"
          ? "Wyłącz osobny TabMaster w Decky, aby na dolnej belce pojawiło się menu KARTY."
          : "Nie udało się zweryfikować działania Decky. Menu pozostaje wyłączone dla bezpieczeństwa.");
        return;
      }
      // This route is Steam's native launcher library, NOT a Hub settings page.
      Navigation.Navigate("/library");
      Navigation.CloseSideMenus();
    } catch {
      setError("Nie udało się otworzyć biblioteki Steam.");
    } finally {
      setBusy(false);
    }
  }

  async function visibility(id: string, show: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const existing = await readTabs();
      const stored = await saveTabs(existing.map(tab =>
        tab.id === id ? { ...tab, hidden: !show } : tab));
      setTabs(stored);
      tabManagerTabsChanged(stored);
    } catch {
      setError("Nie udało się zapisać widoczności karty.");
    } finally { setBusy(false); }
  }

  function openVisibility(parent: EventTarget | null) {
    if (!parent) return;
    const systemTabs = availableSteamLibraryTabs();
    showContextMenu(
      <Menu label="Wyświetlaj karty">
        {tabs.length === 0 && <MenuItem disabled>Brak własnych kart</MenuItem>}
        {systemTabs.map(tab => <MenuItem key={tab.id}
          onClick={() => { void setSystemTabHidden(tab.id, !tab.hidden).catch(() =>
            setError("Nie można zmienić widoczności tej karty Steam.")); }}>
          {tab.hidden ? "Pokaż" : "Ukryj"} · Steam · {tab.title}
        </MenuItem>)}
        {tabs.map(tab => <MenuItem key={tab.id} disabled={busy}
          onClick={() => { void visibility(tab.id, tab.hidden); }}>
          {tab.hidden ? "Pokaż" : "Ukryj"} · {tab.title}
        </MenuItem>)}
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Karty</DialogControlsSectionHeader>
    <Field label="Zarządzaj"
      description="Biblioteka launchera Steam w Gaming Mode. Zaznacz kartę i użyj ☰ KARTY na dolnej belce.">
      <DialogButton disabled={busy} onClick={() => { void manage(); }}>
        Otwórz bibliotekę Steam
      </DialogButton>
    </Field>
    <Field label="Wyświetlaj"
      description="Ukryj lub przywróć karty systemowe Steam i własne karty Huba.">
      <DialogButton disabled={busy} onClick={event => openVisibility(event.currentTarget)}>
        Karty
      </DialogButton>
    </Field>
    {activity === "active" && <Field label="Konflikt"
      description="Osobny TabMaster jest aktywny. Po jego wyłączeniu menu Huba będzie można włączyć przez ponowne sprawdzenie." />}
    {activity === "unknown" && <Field label="Stan modułu"
      description="Nie można zweryfikować stanu dodatków Decky. Menu na dolnej belce pozostaje nieaktywne." />}
    <Field label="Sprawdź integrację" description={tabManagerStatus().statusDetail}>
      <DialogButton disabled={busy} onClick={() => { void refreshTabManagerConflict().then(setActivity); }}>
        Odśwież
      </DialogButton>
    </Field>
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

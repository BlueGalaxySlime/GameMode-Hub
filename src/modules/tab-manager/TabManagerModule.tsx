import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Field, Menu, MenuItem, Navigation, showContextMenu
} from "@decky/ui";
import type { TabDefinition } from "./LibraryIntegration";
import {
  tabManagerEnabledChanged, tabManagerTabsChanged,
  tabManagerConflictChanged, detectTabMasterActivity
} from "./LibraryIntegration";
import type { TabMasterActivity } from "./TabMasterDetection";

const readEnabled = callable<[], boolean>("get_tab_manager_enabled");
const saveEnabled = callable<[boolean], boolean>("set_tab_manager_enabled");
const readTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const saveTabs = callable<[TabDefinition[]], TabDefinition[]>("save_tab_definitions");

/** Only options here. Card editing lives on Steam's library tabs via Menu. */
export function TabManagerModule() {
  const [enabled, setEnabled] = useState(false);
  const [activity, setActivity] = useState<TabMasterActivity>("unknown");
  const [tabs, setTabs] = useState<TabDefinition[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const status = detectTabMasterActivity();
    setActivity(status);
    tabManagerConflictChanged(status !== "inactive");
    Promise.all([readEnabled(), readTabs()]).then(([value, definitions]) => {
      if (!alive) return;
      setEnabled(value);
      setTabs(definitions);
    }).catch(() => {
      if (alive) setError("Nie udało się odczytać ustawień kart.");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  async function prepareLibrary(): Promise<boolean> {
    if (busy) return false;
    const status = detectTabMasterActivity();
    setActivity(status);
    tabManagerConflictChanged(status !== "inactive");
    if (status !== "inactive") {
      setError(status === "active"
        ? "Wyłącz TabMaster w Decky, aby uniknąć konfliktu."
        : "Nie można sprawdzić stanu dodatków Decky. Integracja pozostaje wstrzymana.");
      return false;
    }
    if (enabled) return true;
    setBusy(true); setError("");
    try {
      const saved = await saveEnabled(true);
      setEnabled(saved);
      tabManagerEnabledChanged(saved);
      return saved;
    } catch {
      setError("Nie udało się włączyć obsługi kart biblioteki.");
      return false;
    } finally { setBusy(false); }
  }

  async function manage() {
    if (!(await prepareLibrary())) return;
    Navigation.Navigate("/library");
    Navigation.CloseSideMenus();
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

  function openVisibility(parent: EventTarget) {
    showContextMenu(
      <Menu label="Wyświetlanie kart">
        {tabs.length === 0 && <MenuItem disabled>Brak własnych kart</MenuItem>}
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
      description="Otwórz bibliotekę. Na zaznaczonej karcie naciśnij ☰, aby wyświetlić menu kart.">
      <DialogButton disabled={busy} onClick={() => { void manage(); }}>
        Biblioteka
      </DialogButton>
    </Field>
    <Field label="Wyświetlanie"
      description="Pokaż lub ukryj własne karty. Karty systemowe Steam pozostają bez zmian.">
      <DialogButton disabled={busy} onClick={event => openVisibility(event.currentTarget)}>
        Karty
      </DialogButton>
    </Field>
    {activity === "active" && <Field label="Konflikt"
      description="TabMaster zarządza obecnie biblioteką. Hub nie modyfikuje jej kart." />}
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

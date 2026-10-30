import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogControlsSection, DialogControlsSectionHeader,
  Field, showContextMenu
} from "@decky/ui";
import {
  tabManagerEnabledChanged, refreshTabManagerConflict, tabManagerStatus
} from "./LibraryIntegration";
import { LibraryCardsContextMenu } from "./LibraryCardsContextMenu";
import type { TabMasterActivity } from "./TabMasterDetection";
import { OptimizationManageControl } from "../../hub/OptimizationManageControl";

const readEnabled = callable<[], boolean>("get_tab_manager_enabled");
const saveEnabled = callable<[boolean], boolean>("set_tab_manager_enabled");

/** Compact Optimization settings. The same menu is used on Steam library cards. */
export function TabManagerModule() {
  const [enabled, setEnabled] = useState(false);
  const [activity, setActivity] = useState<TabMasterActivity>("unknown");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([readEnabled(), refreshTabManagerConflict()]).then(([value, status]) => {
      if (!alive) return;
      setEnabled(value);
      setActivity(status);
    }).catch(() => {
      if (alive) setError("Nie udało się odczytać ustawień kart.");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  async function toggle(value: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Settings must persist before changing the active Steam library patch.
      const stored = await saveEnabled(value);
      setEnabled(stored);
      tabManagerEnabledChanged(stored);
      if (stored) setActivity(await refreshTabManagerConflict());
    } catch {
      setError("Nie udało się zapisać ustawienia kart.");
    } finally {
      setBusy(false);
    }
  }

  function openManageMenu(parent: EventTarget | null) {
    if (busy || !parent) return;
    // Same native SteamOS context menu and actions as the library's Menu button.
    // No selected tab in Optimization: only shared actions; selected-card
    // rename/hide/delete remain available exclusively in the Steam library.
    showContextMenu(
      <LibraryCardsContextMenu selectedTabId="" />,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Karty</DialogControlsSectionHeader>
    <OptimizationManageControl busy={busy} enabled={enabled}
      onManage={openManageMenu} onToggle={value => { void toggle(value); }} />
    {enabled && activity === "active" && <Field label="Konflikt"
      description="Aktywny TabMaster blokuje menu Huba w bibliotece. Wyłącz go w Decky." />}
    {enabled && activity === "unknown" && <Field label="Stan modułu"
      description="Nie można potwierdzić stanu dodatków Decky. Menu biblioteki pozostaje wstrzymane." />}
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

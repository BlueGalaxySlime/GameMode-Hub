import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field, Toggle } from "@decky/ui";
import {
  tabManagerEnabledChanged, tabManagerConflictChanged, detectTabMasterActivity
} from "./LibraryIntegration";
import type { TabMasterActivity } from "./TabMasterDetection";

const readEnabled = callable<[], boolean>("get_tab_manager_enabled");
const saveEnabled = callable<[boolean], boolean>("set_tab_manager_enabled");

/** Library cards are edited inside Steam's library. Only options live in Optimization. */
export function TabManagerModule() {
  const [enabled, setEnabled] = useState(false);
  const [activity, setActivity] = useState<TabMasterActivity>("unknown");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  function refreshConflict() {
    const next = detectTabMasterActivity();
    setActivity(next);
    tabManagerConflictChanged(next !== "inactive");
  }

  useEffect(() => {
    let mounted = true;
    const status = detectTabMasterActivity();
    setActivity(status);
    tabManagerConflictChanged(status !== "inactive");
    readEnabled().then(value => {
      if (mounted) setEnabled(value);
    }).catch(() => {
      if (mounted) setError("Nie udało się odczytać ustawień kart.");
    }).finally(() => {
      if (mounted) setBusy(false);
    });
    return () => { mounted = false; };
  }, []);

  async function toggle(value: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      refreshConflict();
      const saved = await saveEnabled(value);
      setEnabled(saved);
      tabManagerEnabledChanged(saved);
    } catch {
      setError("Nie udało się zapisać ustawienia.");
    } finally {
      setBusy(false);
    }
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Karty</DialogControlsSectionHeader>
    <Field label="Własne karty biblioteki"
      description="Dodawaj i edytuj karty bezpośrednio w bibliotece Gaming Mode, przez przycisk + na pasku kart.">
      <Toggle value={enabled} disabled={busy} onChange={value => { void toggle(value); }} />
    </Field>
    {enabled && activity !== "inactive" && <Field label="Integracja wstrzymana"
      description={activity === "active"
        ? "TabMaster jest aktywny. Wyłącz go w Decky."
        : "Nie można sprawdzić stanu TabMastera. Dla bezpieczeństwa biblioteka nie jest modyfikowana."}>
      <DialogButton disabled={busy} onClick={refreshConflict}>Sprawdź ponownie</DialogButton>
    </Field>}
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

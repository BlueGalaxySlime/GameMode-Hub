import { useEffect, useState, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogControlsSection, Field, Toggle } from "@decky/ui";
import { applyHubPreferences, getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
import type { HubPreferences } from "../core/hubSession";
import { withTimeout } from "../utils/withTimeout";

const readOptions = callable<[], HubPreferences>("get_hub_preferences");
const saveOptions = callable<[HubPreferences], HubPreferences>("set_hub_preferences");

export function initializeHubOptions() {
  // Used by HubPage on mount. Failure keeps safe local defaults.
  return withTimeout(readOptions(), 4000).then(applyHubPreferences);
}

export function HubOptionsPage() {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // This page may be opened directly; always keep defaults if Decky is offline.
  useEffect(() => { void initializeHubOptions().catch(() => {}); }, []);

  async function update(key: keyof HubPreferences, enabled: boolean) {
    if (saving) return;
    const previous = getHubPreferences();
    const next = applyHubPreferences({ ...previous, [key]: enabled });
    setError("");
    setSaving(true);
    try {
      const saved = await withTimeout(saveOptions(next), 4000);
      applyHubPreferences(saved);
    } catch {
      applyHubPreferences(previous);
      setError("Nie udało się zapisać opcji. Sprawdź połączenie z Decky.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogBody>
    <DialogControlsSection>
      <Field label="Zachowuj stan kart"
        description="Zapamiętaj otwarte katalogi, sortowanie, zaznaczenia, schowek i ustawienia paneli przy zmianie zakładki. Dane sesji pozostają w pamięci, nie na dysku.">
        <Toggle value={options.saveSession} disabled={saving}
          onChange={value => { void update("saveSession", value); }} />
      </Field>
      <Field label="Automatycznie pokazuj klawiaturę"
        description="Włącz: klawiatura ekranowa Steam przy edycji pól Huba. Wyłącz: pola przyjmują tekst z klawiatury fizycznej bez automatycznego wywoływania ekranowej. Ustawienie wspólne dla Plików i Terminala.">
        <Toggle value={options.autoKeyboard} disabled={saving}
          onChange={value => { void update("autoKeyboard", value); }} />
      </Field>
      {error && <Field label="Błąd" description={error} />}
    </DialogControlsSection>
  </DialogBody>;
}

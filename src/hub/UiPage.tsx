import { useState, useSyncExternalStore } from "react";
import {
  DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Field, Toggle
} from "@decky/ui";
import { gameUiOptions, saveGameUi, subscribeGameUi } from "../game-view/gameViewStore";
import { ProtonDBPage } from "./ProtonDBPage";
import { TabManagerModule } from "../modules/tab-manager/TabManagerModule";
import { CollectionsModule } from "../modules/collection-manager/CollectionsModule";

/**
 * Like Opcje Huba: one scrollable page with ordinary sections.
 * No additional row of category buttons or fake empty subpages.
 */
export function UiPage() {
  const settings = useSyncExternalStore(subscribeGameUi, gameUiOptions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showLookup, setShowLookup] = useState(false);

  async function update(key: "enabled" | "show_protondb", value: boolean) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveGameUi({ ...settings, [key]: value });
    } catch {
      setError("Nie można zapisać ustawienia. Sprawdź działanie Decky.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Gaming Mode</DialogControlsSectionHeader>
      <Field label="Wspólne zakładki gry"
        description="Jednolity układ ekranu gry dla Steam, Epic i GOG. Nie zmienia przycisku Graj.">
        <Toggle value={settings.enabled} disabled={saving}
          onChange={value => { void update("enabled", value); }} />
      </Field>
      <Field label="Oceny ProtonDB"
        description="Pokazuj oceny kompatybilności na ekranie gry.">
        <Toggle value={settings.show_protondb} disabled={saving}
          onChange={value => { void update("show_protondb", value); }} />
      </Field>
      <Field label="ProtonDB" description="Sprawdź ręcznie wybraną grę.">
        <DialogButton onClick={() => setShowLookup(value => !value)}>
          {showLookup ? "Zamknij" : "Sprawdź"}
        </DialogButton>
      </Field>
      {showLookup && <ProtonDBPage />}
      {error && <Field label="Błąd" description={error} />}
    </DialogControlsSection>
    <TabManagerModule />
    <CollectionsModule />
  </DialogBody>;
}

import { useState, useSyncExternalStore } from "react";
import { DialogBody, DialogButton, DialogControlsSection, Field, Focusable,
  NavEntryPositionPreferences, Toggle } from "@decky/ui";
import { gameUiOptions, saveGameUi, subscribeGameUi } from "../game-view/gameViewStore";
import { useHubSessionState } from "./useHubSessionState";
import { ProtonDBPage } from "./ProtonDBPage";

type Category = "gaming" | "display" | "console";

/** One UI module. ProtonDB is a data source in the game screen, not a hub page. */
export function UiPage() {
  const [category, setCategory] = useHubSessionState<Category>("ui.category","gaming");
  const settings = useSyncExternalStore(subscribeGameUi, gameUiOptions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showLookup, setShowLookup] = useState(false);

  async function update(key: "enabled" | "show_protondb", value: boolean) {
    if (saving) return;
    setSaving(true); setError("");
    try { await saveGameUi({ ...settings, [key]: value }); }
    catch { setError("Nie można zapisać ustawienia. Sprawdź działanie Decky."); }
    finally { setSaving(false); }
  }
  return <DialogBody><DialogControlsSection>
    <Focusable flow-children="row"
      navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
      style={{display:"flex",flexDirection:"row",gap:8}}>
      <DialogButton preferredFocus={category==="gaming"}
        onClick={()=>setCategory("gaming")}>Gaming Mode</DialogButton>
      <DialogButton preferredFocus={category==="display"}
        onClick={()=>setCategory("display")}>Obraz</DialogButton>
      <DialogButton preferredFocus={category==="console"}
        onClick={()=>setCategory("console")}>Konsola</DialogButton>
    </Focusable>
    {category==="gaming" ? <>
      <Field label="Wspólne informacje o grze"
        description="Spójny pasek źródła, czasu gry i zgodności na ekranach Steam i skrótów GOG, Epic itd. Nie zastępuje natywnego przycisku Graj ani elementów launchera. Domyślnie wyłączony do testów na urządzeniu.">
        <Toggle value={settings.enabled} disabled={saving}
          onChange={value=>{void update("enabled",value);}} />
      </Field>
      <Field label="Oceny ProtonDB"
        description="ProtonDB jest częścią ekranu gry, a nie osobną zakładką. Dla GOG można powiązać Steam AppID z ekranu gry. Wyniki są zapisywane na 24 godziny.">
        <Toggle value={settings.show_protondb} disabled={saving}
          onChange={value=>{void update("show_protondb",value);}} />
      </Field>
      <Field label="Źródła gier"
        description="Automatycznie: Steam i rozpoznane skróty. GOG/Epic/Heroic/Lutris/Bottles mogą wymagać ręcznego wyboru źródła. Nie zmieniamy poleceń uruchamiania. Ponownie otwórz kartę gry po zmianie ustawień." />
      <DialogButton onClick={()=>setShowLookup(value=>!value)}>
        {showLookup ? "Ukryj ręczne sprawdzanie ProtonDB" : "Sprawdź grę ręcznie w ProtonDB"}
      </DialogButton>
      {showLookup && <ProtonDBPage />}
    </> : <Field
      label={category==="display" ? "Obraz" : "Konsola"}
      description={category==="display"
        ? "Przyszłe ustawienia wyglądu ekranu gry będą tu dodawane osobno. Obecnie brak aktywnych modyfikacji obrazu."
        : "Przyszłe ustawienia elementów konsoli i sterowania. Hub nie modyfikuje mapowania przycisków SteamOS."} />}
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection></DialogBody>;
}

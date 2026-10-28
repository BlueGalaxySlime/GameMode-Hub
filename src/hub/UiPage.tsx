import { useState, useSyncExternalStore } from "react";
import { DialogBody, DialogButton, DialogControlsSection, Field, Focusable,
  NavEntryPositionPreferences, Toggle } from "@decky/ui";
import { gameUiOptions, saveGameUi, subscribeGameUi } from "../game-view/gameViewStore";
import { useHubSessionState } from "./useHubSessionState";
import { ProtonDBPage } from "./ProtonDBPage";
import { TabManagerModule } from "../modules/tab-manager/TabManagerModule";
import { CollectionsModule } from "../modules/collection-manager/CollectionsModule";

type Category = "gaming" | "display" | "console";
type GamingModule = "overview" | "cards" | "collections";

/** Optimization groups gameplay, library, picture and console controls. */
export function UiPage() {
  const [category, setCategory] = useHubSessionState<Category>("ui.category","gaming");
  const [gamingModule, setGamingModule] =
    useHubSessionState<GamingModule>("ui.gamingModule", "overview");
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
    {category==="gaming" && <>
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{display:"flex",flexDirection:"row",gap:8,flexWrap:"wrap"}}>
        <DialogButton onClick={()=>setGamingModule("overview")}>Ogólne</DialogButton>
        <DialogButton onClick={()=>setGamingModule("cards")}>Karty</DialogButton>
        <DialogButton onClick={()=>setGamingModule("collections")}>Kolekcje</DialogButton>
      </Focusable>
    </>}
    {category==="gaming" && gamingModule==="overview" && <>
      <Field label="Wspólne zakładki gry"
        description="Wzór nawigacji jak w SteamOS. Steam zachowuje własne działające zakładki, a skróty GOG, Epic i innych launcherów otrzymują zakładki z ich nazwami i obsługiwanymi funkcjami. Nie zastępuje Unifideck ani przycisku Graj.">
        <Toggle value={settings.enabled} disabled={saving}
          onChange={value=>{void update("enabled",value);}} />
      </Field>
      <Field label="Oceny ProtonDB"
        description="ProtonDB jest częścią ekranu gry, a nie osobną zakładką. Dla GOG można powiązać Steam AppID z ekranu gry. Wyniki są zapisywane na 24 godziny.">
        <Toggle value={settings.show_protondb} disabled={saving}
          onChange={value=>{void update("show_protondb",value);}} />
      </Field>
      <Field label="Źródła gier"
        description="Jeden układ: aktywność, biblioteka, społeczność, informacje. Nazwy i działania zależą od sklepu. Źródło Unifideck (np. gog:ID) jest rozpoznawane z opcji uruchamiania; nieznane skróty można przypisać ręcznie." />
      <DialogButton onClick={()=>setShowLookup(value=>!value)}>
        {showLookup ? "Ukryj ręczne sprawdzanie ProtonDB" : "Sprawdź grę ręcznie w ProtonDB"}
      </DialogButton>
      {showLookup && <ProtonDBPage />}
    </>}
    {category!=="gaming" && <Field
      label={category==="display" ? "Obraz" : "Konsola"}
      description={category==="display"
        ? "Przyszłe ustawienia wyglądu ekranu gry będą tu dodawane osobno. Obecnie brak aktywnych modyfikacji obrazu."
        : "Przyszłe ustawienia elementów konsoli i sterowania. Hub nie modyfikuje mapowania przycisków SteamOS."} />}
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>
    {category==="gaming" && gamingModule==="cards" && <TabManagerModule />}
    {category==="gaming" && gamingModule==="collections" && <CollectionsModule />}
  </DialogBody>;
}

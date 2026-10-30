import { useEffect, useState, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogControlsSection, DialogControlsSectionHeader, Dropdown, Field, SliderField, Toggle } from "@decky/ui";
import { applyHubPreferences, getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
import type { HubPreferences } from "../core/hubSession";
import { withTimeout } from "../utils/withTimeout";

const readOptions = callable<[], HubPreferences>("get_hub_preferences");
const saveOptions = callable<[HubPreferences], HubPreferences>("set_hub_preferences");
type DevStatus = { enabled: boolean; state?: "sleeping" | "active" | "background";
  backend_cpu_percent?: number | null; backend_rss_mib?: number | null;
  active_downloads?: number;
  checks?: Record<string, {
    state: string; checked_at: number | null; next_check_at: number | null; error: string;
  }>;
};
const readDev = callable<[], DevStatus>("hub_dev_diagnostics");

export function initializeHubOptions() {
  // Used by HubPage on mount. Failure keeps safe local defaults.
  return withTimeout(readOptions(), 4000).then(applyHubPreferences);
}

export function HubOptionsPage({ terminalFontSize, setTerminalFontSize }: {
  terminalFontSize: number;
  setTerminalFontSize: (value: number) => void;
}) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dev, setDev] = useState<DevStatus | null>(null);
  useEffect(() => {
    if (!options.developerMode) { setDev(null); return; }
    let alive = true;
    let pending = false;
    async function measure() {
      if (pending) return;
      pending = true;
      try {
        const next = await withTimeout(readDev(), 4000);
        if (alive) setDev(next);
      } catch { /* Diagnostic failures must never freeze Gaming Mode. */ }
      finally { pending = false; }
    }
    void measure();
    const timer = window.setInterval(() => { void measure(); }, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [options.developerMode]);

  // This page may be opened directly; always keep defaults if Decky is offline.
  useEffect(() => { void initializeHubOptions().catch(() => {}); }, []);

  async function update<K extends keyof HubPreferences>(key: K, value: HubPreferences[K]) {
    if (saving) return;
    const previous = getHubPreferences();
    const next = applyHubPreferences({ ...previous, [key]: value });
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

  const english = options.language === "en";

  return <DialogBody>
    <DialogControlsSection>
      <Field label={english ? "Language" : "Język"}
        description={english ? "Hub interface language (Polish or English)." :
          "Język interfejsu Huba. Na razie dostępne są polski i angielski."}>
        <Dropdown
          rgOptions={[{ data: "pl", label: "Polski" }, { data: "en", label: "English" }]}
          selectedOption={options.language}
          disabled={saving}
          onChange={option => {
            if (option.data === "pl" || option.data === "en")
              void update("language", option.data);
          }} />
      </Field>
      <Field label={english ? "Remember tab state" : "Zachowuj stan kart"}
        description={english
          ? "Preserve open folders, sorting, selections and clipboard when switching tabs. Session data stays in memory."
          : "Zapamiętaj otwarte katalogi, sortowanie, zaznaczenia, schowek i ustawienia paneli przy zmianie zakładki. Dane sesji pozostają w pamięci, nie na dysku."}>
        <Toggle value={options.saveSession} disabled={saving}
          onChange={value => { void update("saveSession", value); }} />
      </Field>
      <Field label={english ? "Show on-screen keyboard automatically" : "Automatycznie pokazuj klawiaturę"}
        description={english
          ? "Show the Steam on-screen keyboard when editing Hub fields. Disable to use a physical keyboard without opening it."
          : "Włącz: klawiatura ekranowa Steam przy edycji pól Huba. Wyłącz: pola przyjmują tekst z klawiatury fizycznej bez automatycznego wywoływania ekranowej. Ustawienie wspólne dla Plików, Pulpitu i Terminala."}>
        <Toggle value={options.autoKeyboard} disabled={saving}
          onChange={value => { void update("autoKeyboard", value); }} />
      </Field>
      <Field label={english ? "Developer mode" : "Tryb DEV"}
        description={english ? "Measurements run only while Hub Options is open." :
          "Pomiary tylko podczas otwartych Opcji Huba. Bez stałego monitorowania podczas gry."}>
        <Toggle value={options.developerMode} disabled={saving}
          onChange={value => { void update("developerMode", value); }} />
      </Field>
      {options.developerMode && <Field label="Zasoby backendu"
        description={dev?.enabled
          ? ("Stan: " + ({ sleeping: "Uśpiony", active: "Aktywny",
                            background: "Praca w tle" }[dev.state ?? "sleeping"]) +
             " · CPU: " + (dev.backend_cpu_percent ?? "—") + "%" +
             " · RAM: " + (dev.backend_rss_mib ?? "—") + " MiB" +
             " · Pobieranie: " + (dev.active_downloads ?? 0))
          : "Trwa odczyt…"} />}
      {options.developerMode && dev?.checks &&
        Object.entries(dev.checks).map(([key, check]) =>
          <Field key={key} label={"Sprawdzanie: " + key}
            description={"Stan: " + check.state +
              " · Ostatnio: " + (check.checked_at
                ? new Date(check.checked_at * 1000).toLocaleString("pl-PL") : "nigdy") +
              " · Kolejne: " + (check.next_check_at
                ? new Date(check.next_check_at * 1000).toLocaleString("pl-PL") : "na żądanie") +
              (check.error ? " · " + check.error : "")} />)}
      {error && <Field label="Błąd" description={error} />}
    </DialogControlsSection>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Terminal</DialogControlsSectionHeader>
      <Field label={english ? "Start on demand" : "Uruchamianie na żądanie"}
        description={english ? "The Linux shell starts only after selecting Start terminal. It does not launch when opening the tab. Handheld testing is required." :
          "PTY uruchamia się dopiero po wybraniu Uruchom terminal. Brak automatycznego startu po wejściu na kartę. Przed udostępnieniem wersji stabilnej wymagane testy na handheldzie."} />
      <Field label={english ? "Terminal font size" : "Rozmiar czcionki terminala"}
        description={english ? "Adjust the terminal font without starting a shell." :
          "Wielkość czcionki w terminalu Huba. Zmiana nie uruchamia powłoki."}>
        <SliderField min={11} max={22} step={1} value={terminalFontSize}
          showValue onChange={setTerminalFontSize} />
      </Field>
    </DialogControlsSection>
  </DialogBody>;
}

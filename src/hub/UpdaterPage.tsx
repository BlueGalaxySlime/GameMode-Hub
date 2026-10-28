import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection,
  DialogControlsSectionHeader, Field, Menu, MenuItem, showContextMenu
} from "@decky/ui";
import { RequestTimeoutError, withTimeout } from "../utils/withTimeout";
import { APP_NAME, DECKY_PLUGIN_NAME } from "../core/identity";
import { ReleaseEntry, UpdateChannel, selectReleases } from "../core/releaseCatalog";
import { useHubSessionState } from "./useHubSessionState";

const VERSION = "0.5.33";
const URL = "https://api.github.com/repos/BlueGalaxySlime/GameMode-Hub/releases?per_page=50";
const getChannel = callable<[], UpdateChannel>("get_update_channel");
const saveChannel = callable<[UpdateChannel], UpdateChannel>("set_update_channel");
const backendList = callable<[UpdateChannel], ReleaseEntry[]>("list_releases");

type DeckyInstaller = {
  callable: (method: string) => (...args: unknown[]) => Promise<unknown>;
};

async function fetchVersions(channel: UpdateChannel): Promise<ReleaseEntry[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error("GitHub HTTP " + response.status);
    return selectReleases(await response.json(), channel, VERSION);
  } finally {
    clearTimeout(timer);
  }
}

export function UpdaterPage() {
  const [channel, setChannel] = useHubSessionState<UpdateChannel>("updates.channel","test");
  const [entries, setEntries] = useHubSessionState<ReleaseEntry[]>("updates.entries",[]);
  const [selected, setSelected] = useHubSessionState<ReleaseEntry | null>("updates.selected",null);
  const [confirmDowngrade, setConfirmDowngrade] = useHubSessionState("updates.confirmDowngrade",false);
  const [message, setMessage] = useHubSessionState("updates.message","Wybierz kanał i sprawdź dostępne wersje.");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useHubSessionState("updates.checked",false);
  const [lastChecked, setLastChecked] = useHubSessionState<string | null>("updates.lastChecked",null);
  const busy = useRef(false);

  useEffect(() => {
    let mounted = true;
    // Read a single local preference. Failure leaves the default test channel.
    withTimeout(getChannel(), 2000).then(value => {
      if (mounted && (value === "test" || value === "stable")) setChannel(value);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  async function chooseChannel(next: UpdateChannel) {
    if (busy.current || next === channel) return;
    setChannel(next);
    setEntries([]);
    setSelected(null);
    setChecked(false);
    setConfirmDowngrade(false);
    setMessage(next === "stable"
      ? "Kanał Stabilny jest na razie pusty. Sprawdź, czy pojawiły się zatwierdzone wydania."
      : "Kanał Testowy udostępnia wersje próbne oraz 0.5.2 do awaryjnego powrotu.");
    try {
      await withTimeout(saveChannel(next), 3000);
    } catch {
      setMessage("Kanał wybrano, ale nie udało się zapisać ustawienia. Sprawdź backend Decky.");
    }
  }

  async function check() {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setEntries([]);
    setSelected(null);
    setChecked(false);
    setConfirmDowngrade(false);
    setMessage("Sprawdzanie dostępnych wersji…");
    try {
      let result: ReleaseEntry[];
      try {
        result = await fetchVersions(channel);
        // Steam's embedded browser can occasionally return a successful but
        // empty/stale response. In the test channel try the Python backend too,
        // rather than incorrectly claiming there are no newer releases.
        if (channel === "test" && result.length === 0) {
          throw new Error("Przeglądarka zwróciła pusty katalog testowy.");
        }
      } catch (browserError) {
        try {
          const fallback: unknown = await withTimeout(backendList(channel), 11000);
          if (!Array.isArray(fallback)) {
            throw new Error("Backend zwrócił nieprawidłową listę wersji.");
          }
          result = fallback as ReleaseEntry[];
        } catch (backendError) {
          throw new Error("Nie udało się pobrać listy wersji przez Steam ani Decky: " +
            String(browserError) + " / " + String(backendError));
        }
      }
      setEntries(result);
      setChecked(true);
      setMessage(result.length
        ? "Wybierz wersję z listy. Starsze wersje wymagają dodatkowego potwierdzenia."
        : channel === "stable"
          ? "Kanał Stabilny jest pusty — nie opublikowano jeszcze zatwierdzonego wydania."
          : "Brak poprawnych wydań Testowych z sumą SHA-256.");
    } catch (error) {
      setMessage(error instanceof RequestTimeoutError
        ? "Przekroczono limit czasu odpowiedzi. Sprawdź połączenie i spróbuj ponownie."
        : "Błąd sprawdzania: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLastChecked(new Date().toLocaleString("pl-PL"));
      busy.current = false;
      setChecking(false);
    }
  }

  function selectVersion(entry: ReleaseEntry) {
    if (busy.current) return;
    setSelected(entry);
    setConfirmDowngrade(false);
    if (entry.action === "installed") setMessage("Ta wersja jest już zainstalowana.");
    else if (entry.action === "downgrade") setMessage("Wybrano starszą wersję " + entry.version + ". Ustawienia mogą nie być zgodne po cofnięciu.");
    else setMessage("Wybrano aktualizację do wersji " + entry.version + ".");
  }

  // Native Steam overlay: options appear above the update screen, rather
  // than growing the page vertically and making the D-pad scroll past them.
  function openChannelMenu(parent: EventTarget) {
    if (busy.current || checking) return;
    showContextMenu(
      <Menu label="Kanał aktualizacji" cancelText="Wstecz">
        <MenuItem selected={channel === "test"}
          onSelected={() => { void chooseChannel("test"); }}>Testowy</MenuItem>
        <MenuItem selected={channel === "stable"}
          onSelected={() => { void chooseChannel("stable"); }}>Stabilny</MenuItem>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  function openVersionsMenu(parent: EventTarget) {
    if (busy.current || checking || entries.length === 0) return;
    showContextMenu(
      <Menu label="Wybierz wersję" cancelText="Wstecz">
        {entries.map(entry =>
          <MenuItem key={entry.version}
            selected={selected?.version === entry.version}
            onSelected={() => selectVersion(entry)}>
            {entry.version +
              (entry.action === "downgrade" ? " — Downgrade" :
                entry.action === "upgrade" ? " — Aktualizacja" : " — Zainstalowana") +
              (entry.legacy ? " (archiwalna)" : "")}
          </MenuItem>)}
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  async function install() {
    const target = selected;
    if (busy.current || !target || target.action === "installed") return;
    if (!entries.includes(target)) return;
    if (target.action === "downgrade" && !confirmDowngrade) {
      setConfirmDowngrade(true);
      setMessage("Potwierdź cofnięcie do " + target.version +
        ". Starsza wersja może nie odczytać obecnych ustawień. Ustawienia nie są automatycznie cofane.");
      return;
    }
    const decky = (window as Window & { DeckyBackend?: DeckyInstaller }).DeckyBackend;
    if (typeof decky?.callable !== "function") {
      setMessage("Instalator Decky niedostępny. Pobierz ręcznie wskazaną wersję ZIP z GitHub Releases.");
      return;
    }
    busy.current = true;
    setChecking(true);
    setMessage("Otwieranie potwierdzenia instalacji w Decky…");
    try {
      // Decky Loader: UPDATE=2, DOWNGRADE=3 (the latter is not UPDATE).
      const installType = target.action === "downgrade" ? 3 : 2;
      await withTimeout(
        decky.callable("utilities/install_plugin")(
          target.url, DECKY_PLUGIN_NAME, target.version, target.sha256, installType
        ),
        30000
      );
      setConfirmDowngrade(false);
      setMessage("Wysłano żądanie do Decky. Zatwierdź instalację w jego oknie. " +
        "Nie ponawiaj, zanim sprawdzisz numer zainstalowanej wersji.");
    } catch (error) {
      setMessage(error instanceof RequestTimeoutError
        ? "Decky nie potwierdził żądania w 30 sekund. Sprawdź wersję przed kolejną próbą."
        : "Decky odmówił instalacji: " + String(error));
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Aktualizacje {APP_NAME}</DialogControlsSectionHeader>
      <Field label="Zainstalowana wersja" description={VERSION} />
      <Field label="Kanał aktualizacji" description="Stabilny — po zatwierdzeniu na urządzeniu. Testowy — wersje rozwojowe.">
        <DialogButton disabled={checking} onOKActionDescription="Wybierz kanał"
          onClick={event => openChannelMenu(event.currentTarget ?? window)}>
          {channel === "test" ? "Testowy" : "Stabilny"} ▾
        </DialogButton>
      </Field>
      <Field label="Dostępne wersje" description="Sprawdzane tylko na żądanie. Maksymalnie 50 ostatnich wydań GitHub.">
        <DialogButton disabled={checking} onClick={() => { void check(); }}>
          {checking ? "Trwa operacja…" : "Sprawdź wersje"}
        </DialogButton>
      </Field>
      {checked && entries.length === 0 &&
        <Field label="Brak wersji" description={channel === "stable"
          ? "Nie ma jeszcze zatwierdzonego wydania Stabilnego."
          : "Nie znaleziono wersji Testowych ze sprawdzalnym plikiem ZIP."} />}
      {entries.length > 0 && <Field label="Wybierz wersję"
        description="Lista otworzy się nad stroną. Starsze wersje są oznaczone jako downgrade.">
        <DialogButton disabled={checking} onOKActionDescription="Wybierz wersję"
          onClick={event => openVersionsMenu(event.currentTarget ?? window)}>
          {selected
            ? selected.version + (selected.action === "downgrade" ? " — Downgrade" :
                selected.action === "installed" ? " — Zainstalowana" : " — Aktualizacja")
            : "Wybierz z " + entries.length + " dostępnych wersji"} ▾
        </DialogButton>
      </Field>}
      {selected && selected.action !== "installed" &&
        <Field label={"Wybrana wersja: " + selected.version}
          description={selected.action === "downgrade"
            ? "Cofnięcie wersji nie przywraca ustawień. Wymagane potwierdzenie."
            : "Instalacja aktualizacji zostanie potwierdzona również w Decky."}>
          <DialogButton disabled={checking} onClick={() => { void install(); }}>
            {selected.action === "downgrade"
              ? (confirmDowngrade ? "Potwierdź downgrade" : "Cofnij do tej wersji")
              : "Aktualizuj do tej wersji"}
          </DialogButton>
        </Field>}
      {confirmDowngrade && selected?.action === "downgrade" &&
        <Field label="Anuluj cofanie" description="Możesz zrezygnować bez wysyłania żądania do Decky.">
          <DialogButton disabled={checking} onClick={() => setConfirmDowngrade(false)}>Anuluj</DialogButton>
        </Field>}
      <Field label="Stan aktualizacji" description={message} />
      {lastChecked && <Field label="Ostatnie sprawdzenie" description={lastChecked} />}
    </DialogControlsSection>
  </DialogBody>;
}

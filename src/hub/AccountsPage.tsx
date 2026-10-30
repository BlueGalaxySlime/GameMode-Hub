import { useEffect, useState, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Dropdown, Field
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { GamepadScrollArea } from "./GamepadScrollArea";
import { HubTextInput } from "./HubTextInput";
import { useHubSessionState } from "./useHubSessionState";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
import { StoreConnectionRibbon } from "./StoreConnectionRibbon";
import { identifyEpicLaunchers, openEpicLauncher } from "./epicAccountAdapter";
import type { EpicLauncher } from "./epicAccountAdapter";
import type { DesktopApp } from "./DesktopPage";

const listDesktopApps = callable<[], DesktopApp[]>("desktop_list_apps");
const ACCOUNT_OPTIONS = [
  { data: "gog", label: "GOG" },
  { data: "epic", label: "Epic Games" }
];
type GogStatus = { connected: boolean; storage: "memory" | "keyring" | null };
type GogResult = { ok: boolean; code?: string; url?: string; storage?: string };
type GogGame = { store: "gog"; id: string; title: string };
type GogLibrary = { ok: boolean; code?: string; games: GogGame[]; partial?: boolean };

const gogStatus = callable<[], GogStatus>("gog_native_status");
const gogBegin = callable<[string], GogResult>("gog_native_begin");
const gogComplete = callable<[string], GogResult>("gog_native_complete");
const gogLogout = callable<[], GogResult>("gog_native_logout");
const gogLibrary = callable<[], GogLibrary>("gog_library");

const GOG_ERRORS: Record<string, string> = {
  not_logged_in: "Zaloguj się do GOG, żeby wczytać gry.",
  login_expired: "Minął czas logowania. Rozpocznij nowe logowanie.",
  bad_callback: "Wklej pełny adres strony po zalogowaniu z embed.gog.com/on_login_success.",
  login_failed: "GOG odmówił autoryzacji lub połączenie zostało przerwane. Spróbuj ponownie.",
  bad_storage: "Nieobsługiwany sposób zapisu sesji.",
  vault_locked: "Sejf systemowy jest zablokowany. Odblokuj go albo wybierz sesję tymczasową.",
  vault_unavailable: "Sejf systemowy jest niedostępny. Możesz wybrać sesję tymczasową.",
  auth_expired: "Wygasła sesja GOG. Zaloguj się ponownie.",
  network: "Nie udało się połączyć z GOG. Sprawdź internet i spróbuj ponownie.",
  bad_response: "GOG zwrócił nieprawidłową odpowiedź. Nie oznacza to pustej biblioteki."
};

/** Stores, not a launcher switcher. No password/2FA input in GameMode Hub. */
export function AccountsPage() {
  const language = useSyncExternalStore(subscribeHubPreferences, getHubPreferences).language;
  const [selectedAccount, setSelectedAccount] = useHubSessionState<"epic" | "gog">(
    "accounts.selected", "gog"
  );
  const [selectedLauncherId, setSelectedLauncherId] = useHubSessionState(
    "accounts.epic.launcher", ""
  );
  const [launchers, setLaunchers] = useState<EpicLauncher[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState(false);
  const [gog, setGog] = useState<GogStatus | null>(null);
  const [gogStorage, setGogStorage] = useState<"memory" | "keyring">("memory");
  const [gogLoginUrl, setGogLoginUrl] = useState("");
  const [gogRedirect, setGogRedirect] = useState("");
  const [gogBusy, setGogBusy] = useState(false);
  const [gogMessage, setGogMessage] = useState("");
  const [games, setGames] = useState<GogGame[]>([]);
  const [gamesChecked, setGamesChecked] = useState(false);
  const [partial, setPartial] = useState(false);
  const chosenLauncher = launchers.find(
    launcher => launcher.app.id === selectedLauncherId
  ) ?? launchers[0];

  async function refreshGog() {
    try {
      const status = await withTimeout(gogStatus(), 6000);
      setGog(status);
    } catch {
      setGog(null);
      setGogMessage("Nie można sprawdzić połączenia GOG z backendem Huba.");
    }
  }

  async function startGog() {
    if (gogBusy) return;
    setGogBusy(true);
    setGogMessage("");
    setGogRedirect("");
    try {
      const result = await withTimeout(gogBegin(gogStorage), 6500);
      if (!result.ok || !result.url) {
        setGogMessage(GOG_ERRORS[result.code ?? ""] ?? GOG_ERRORS.login_failed);
        return;
      }
      setGogLoginUrl(result.url);
      // Steam may block popup windows; offer a copyable URL as a fallback.
      try {
        window.open(result.url, "_blank", "noopener,noreferrer");
        setGogMessage("Zaloguj się na stronie GOG. Po zalogowaniu skopiuj pełny adres strony powrotu i wklej go poniżej.");
      } catch {
        setGogMessage("Otwieranie przeglądarki jest niedostępne. Skopiuj adres logowania i otwórz go w przeglądarce.");
      }
    } catch {
      setGogMessage("Nie udało się rozpocząć logowania GOG.");
    } finally {
      setGogBusy(false);
    }
  }

  async function copyGogUrl() {
    if (!gogLoginUrl) return;
    try {
      await navigator.clipboard.writeText(gogLoginUrl);
      setGogMessage("Skopiowano adres logowania GOG. Otwórz go w przeglądarce.");
    } catch {
      setGogMessage("Schowek jest niedostępny. Spróbuj ponownie otworzyć stronę.");
    }
  }

  async function finishGog() {
    if (gogBusy || !gogRedirect.trim()) return;
    setGogBusy(true);
    setGogMessage("");
    // Authorization codes must never be persisted in Hub preferences.
    const callback = gogRedirect.trim();
    setGogRedirect("");
    try {
      const result = await withTimeout(gogComplete(callback), 21000);
      if (!result.ok) {
        setGogMessage(GOG_ERRORS[result.code ?? ""] ?? GOG_ERRORS.login_failed);
      } else {
        setGogLoginUrl("");
        setGogMessage(result.storage === "keyring"
          ? "Zalogowano do GOG. Sesja jest zapisana w sejfie systemowym."
          : "Zalogowano do GOG. Sesja jest tymczasowa i wygaśnie po zamknięciu backendu Huba.");
        await refreshGog();
      }
    } catch {
      setGogMessage("Nie udało się zakończyć logowania. Sprawdź stan połączenia.");
      await refreshGog();
    } finally {
      setGogBusy(false);
    }
  }

  async function disconnectGog() {
    if (gogBusy) return;
    setGogBusy(true);
    try {
      const result = await withTimeout(gogLogout(), 7000);
      if (!result.ok) {
        setGogMessage(GOG_ERRORS[result.code ?? ""] ?? "Nie udało się usunąć sesji.");
      } else {
        setGames([]);
        setGamesChecked(false);
        setGogLoginUrl("");
        setGogRedirect("");
        setGogMessage("Odłączono GOG od Huba, bez zmieniania Unifideck.");
        await refreshGog();
      }
    } catch {
      setGogMessage("Nie udało się wylogować z Huba. Sprawdź sejf.");
    } finally {
      setGogBusy(false);
    }
  }

  async function loadGogGames() {
    if (gogBusy || !gog?.connected) return;
    setGogBusy(true);
    setGogMessage("");
    try {
      const response = await withTimeout(gogLibrary(), 58000);
      if (response.ok) {
        setGames(response.games);
        setGamesChecked(true);
        setPartial(!!response.partial);
        setGogMessage("Wczytano bibliotekę GOG.");
      } else {
        setGamesChecked(false);
        setGogMessage(GOG_ERRORS[response.code ?? ""] ?? GOG_ERRORS.network);
      }
    } catch {
      setGamesChecked(false);
      setGogMessage("Przekroczono czas pobierania biblioteki GOG.");
    } finally {
      setGogBusy(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const apps = await withTimeout(listDesktopApps(), 12000);
      setLaunchers(identifyEpicLaunchers(apps));
    } catch {
      setLaunchers([]);
      setMessage("Nie można sprawdzić zainstalowanych launcherów.");
    } finally {
      setChecked(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshGog();
    void refresh();
  }, []);

  async function signIn() {
    if (opening || !chosenLauncher) return;
    setOpening(true);
    setMessage("");
    try {
      await openEpicLauncher(chosenLauncher);
      setMessage("Otworzono launcher. Zaloguj się w jego oknie. Hub nie może potwierdzić stanu sesji.");
    } catch {
      setMessage("Nie udało się uruchomić launchera w Gaming Mode. Sprawdź skrót w zakładce Pulpit.");
    } finally {
      setOpening(false);
    }
  }

  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Konta i sklepy</DialogControlsSectionHeader>
        <StoreConnectionRibbon
          language={language}
          states={{
            steam: "unknown",
            gog: gog === null ? "unknown" : gog.connected ? "connected" : "disconnected",
            epic: "unknown"
          }} />
        <Field label="Wybierz sklep"
          description="Konto i biblioteka należą do sklepu, nie do programu uruchamiającego.">
          <Dropdown rgOptions={ACCOUNT_OPTIONS} selectedOption={selectedAccount}
            onChange={option => {
              if (option.data === "epic" || option.data === "gog")
                setSelectedAccount(option.data);
            }} />
        </Field>
        {selectedAccount === "gog" && <>
          <Field label="GOG — połączenie" focusable highlightOnFocus
            description={!gog
              ? "Sprawdzanie sesji GOG…"
              : gog.connected
                ? (gog.storage === "keyring"
                  ? "Połączono z GOG. Sesja znajduje się w sejfie systemowym."
                  : "Połączono z GOG. Sesja tymczasowa — tylko w pamięci Huba.")
                : "Nie połączono. Możesz zalogować się bez Unifideck i Heroic."} />
          {!gog?.connected && <>
            <Field label="Przechowywanie sesji"
              description="Tymczasowa nie zapisuje tokenów na dysku. Sejf systemowy wymaga działającego KWallet/Secret Service.">
              <Dropdown
                rgOptions={[
                  { data: "memory", label: "Tymczasowa" },
                  { data: "keyring", label: "Sejf systemowy" }
                ]}
                selectedOption={gogStorage}
                onChange={option => {
                  if (option.data === "memory" || option.data === "keyring")
                    setGogStorage(option.data);
                }} />
            </Field>
            <Field label="Zaloguj do GOG"
              description="Otwiera stronę auth.gog.com. Hasło i 2FA wpisujesz tylko na stronie GOG. Hub nie uruchamia Unifideck ani Heroica.">
              <DialogButton disabled={gogBusy} onClick={() => { void startGog(); }}>
                {gogBusy ? "Łączenie…" : "Zaloguj"}
              </DialogButton>
            </Field>
            {!!gogLoginUrl && <>
              <Field label="Adres logowania"
                description="Jeżeli SteamOS nie otworzył strony, skopiuj adres i otwórz go w przeglądarce.">
                <DialogButton disabled={gogBusy} onClick={() => { void copyGogUrl(); }}>
                  Kopiuj adres logowania
                </DialogButton>
              </Field>
              <Field label="Adres powrotu po logowaniu"
                description="Wklej cały adres zaczynający się od https://embed.gog.com/on_login_success lub https://www.gog.com/on_login_success. Nie wklejaj hasła ani kodu 2FA.">
                <HubTextInput value={gogRedirect} onEditValue={setGogRedirect}
                  aria-label="Adres powrotu GOG"
                  onChange={event => setGogRedirect(event.currentTarget.value)}
                  placeholder="https://embed.gog.com/on_login_success?…"
                  disabled={gogBusy} />
                <DialogButton disabled={gogBusy || !gogRedirect.trim()}
                  onClick={() => { void finishGog(); }}>Połącz konto</DialogButton>
              </Field>
            </>}
          </>}
          {gog?.connected && <>
            <Field label="Biblioteka GOG"
              description="Pobieramy posiadane gry z GOG bez otwierania zewnętrznego launchera.">
              <DialogButton disabled={gogBusy} onClick={() => { void loadGogGames(); }}>
                {gogBusy ? "Pobieranie…" : "Wczytaj gry"}
              </DialogButton>
            </Field>
            {gamesChecked && <Field label={"Gry GOG: " + games.length + (partial ? "+" : "")}
              description={partial ? "Widok pokazuje ograniczoną część biblioteki." :
                games.length ? "Gry odczytano z GOG." : "GOG zwrócił pustą bibliotekę."} />}
            {gamesChecked && games.slice(0, 40).map(game =>
              <Field key={game.id} label={game.title} description={"GOG · " + game.id} />)}
            {gamesChecked && games.length > 40 && <Field label="Pozostałe gry"
              description={"Jeszcze " + (games.length - 40) + " pozycji. Przedstawiamy 40, aby nie obciążać interfejsu."} />}
            <Field label="Odłącz GOG"
              description="Usuwa sesję Huba, nie modyfikuje konta ani danych Unifideck.">
              <DialogButton disabled={gogBusy} onClick={() => { void disconnectGog(); }}>
                Wyloguj
              </DialogButton>
            </Field>
          </>}
          <Field label="Sprawdź stan połączenia">
            <DialogButton disabled={gogBusy} onClick={() => { void refreshGog(); }}>
              Odśwież
            </DialogButton>
          </Field>
          {!!gogMessage && <Field label="Informacja" focusable highlightOnFocus
            description={gogMessage} />}
        </>}
        {selectedAccount === "epic" && <>
          <Field label="Epic Games" focusable highlightOnFocus
            description="Stan sesji: niezweryfikowany. Natywne powiązanie biblioteki Epic nie jest jeszcze dostępne." />
          {launchers.length > 1 && <Field label="Program do logowania (tymczasowo)"
            description="Ten ekran zostanie zastąpiony adapterem sklepu Epic.">
            <Dropdown
              rgOptions={launchers.map(launcher => ({
                data: launcher.app.id, label: launcher.label
              }))}
              selectedOption={chosenLauncher?.app.id ?? ""}
              onChange={option => {
                if (launchers.some(launcher => launcher.app.id === option.data))
                  setSelectedLauncherId(String(option.data));
              }} />
          </Field>}
          <Field label="Logowanie do Epic Games"
            description={chosenLauncher
              ? "Tymczasowo otwiera " + chosenLauncher.label + ". Hasło i 2FA wpisujesz wyłącznie w tym programie."
              : "Brak natywnego adaptera. Hub nie ma formularza hasła ani tokenów Epic."}>
            <DialogButton disabled={loading || opening || !chosenLauncher}
              onClick={() => { void signIn(); }}>
              {opening ? "Uruchamianie…" : "Zaloguj"}
            </DialogButton>
          </Field>
          <Field label="Wykrywanie programów"
            description="Wykrywanie skrótów to nie potwierdzenie aktywnej sesji Epic.">
            <DialogButton disabled={loading || opening} onClick={() => { void refresh(); }}>
              {loading ? "Sprawdzanie…" : "Odśwież"}
            </DialogButton>
          </Field>
          {checked && !loading && !launchers.length && <Field
            label="Brak programu Epic"
            description="Natywne logowanie i biblioteka Epic nie zostały jeszcze zaimplementowane." />}
          {!!message && <Field label="Informacja" description={message}
            focusable highlightOnFocus />}
        </>}
      </DialogControlsSection>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Bezpieczeństwo kont</DialogControlsSectionHeader>
        <Field label="Hasła i 2FA" focusable highlightOnFocus
          description="Hub nie przyjmuje haseł ani kodów 2FA. Logowanie pozostaje po stronie sklepu." />
        <Field label="Sesja GOG" focusable highlightOnFocus
                    description="Hub ma własną sesję GOG. Logowanie odbywa się na stronie GOG, bez hasła w Hubie. Tokeny są w pamięci lub opcjonalnie w systemowym sejfie." />
        <Field label="Granice integracji" focusable highlightOnFocus
                    description="GOG pozostaje właścicielem konta. Hub nie odczytuje i nie modyfikuje sesji Unifideck. Logowanie, otwieranie przeglądarki i obsługa pada wymagają testów na Lenovo." />
        <Field label="Szyfrowanie" focusable highlightOnFocus
                    description="Hub nie przechowuje jawnych poświadczeń w plikach. Sejf wymaga aktywnej usługi Secret Service, bez obejścia jej blokady." />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

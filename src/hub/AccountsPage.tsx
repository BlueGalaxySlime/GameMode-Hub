import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Dropdown, Field
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { GamepadScrollArea } from "./GamepadScrollArea";
import { useHubSessionState } from "./useHubSessionState";
import { identifyEpicLaunchers, openEpicLauncher } from "./epicAccountAdapter";
import type { EpicLauncher } from "./epicAccountAdapter";
import type { DesktopApp } from "./DesktopPage";

const listDesktopApps = callable<[], DesktopApp[]>("desktop_list_apps");
const ACCOUNT_OPTIONS = [
  { data: "gog", label: "GOG" },
  { data: "epic", label: "Epic Games" }
];
type GogState = "missing" | "source_missing" | "available" | "linked" | "unusable";
type GogStatus = {
  store: "gog";
  source: "unifideck";
  state: GogState;
  linked: boolean;
  can_import: boolean;
};
type GogResult = { ok: boolean; code?: string } & Partial<GogStatus>;
type GogGame = { store: "gog"; id: string; title: string };
type GogLibrary = { ok: boolean; code?: string; games: GogGame[]; partial?: boolean };

const gogStatus = callable<[], GogStatus>("gog_link_status");
const gogImport = callable<[], GogResult>("gog_link_import");
const gogRemove = callable<[], GogResult>("gog_link_remove");
const gogLibrary = callable<[], GogLibrary>("gog_library");

const GOG_MESSAGES: Record<string, string> = {
  missing: "Nie znaleziono połączenia GOG w Unifideck.",
  source_missing: "Połączenie było powiązane, ale plik sesji Unifideck zniknął.",
  available: "Znaleziono zaszyfrowaną sesję GOG w Unifideck. Możesz ją powiązać za swoją zgodą.",
  linked: "Powiązano z lokalną sesją Unifideck. Hub nie posiada własnej kopii tokenów.",
  unusable: "Plik sesji jest uszkodzony, niezabezpieczony lub ma nieobsługiwany format."
};
const GOG_ERRORS: Record<string, string> = {
  missing: "Unifideck nie udostępnia już pliku sesji GOG.",
  unusable: "Nie można odczytać zaszyfrowanej sesji GOG. Sprawdź logowanie w Unifideck.",
  crypto_unavailable: "Biblioteka szyfrowania jest niedostępna. Sesja nie została zaimportowana.",
  not_linked: "Najpierw powiąż połączenie GOG.",
  auth_expired: "Sesja GOG wymaga odświeżenia. Zaloguj się ponownie w Unifideck i spróbuj ponownie.",
  network: "Nie udało się pobrać biblioteki GOG. Sprawdź połączenie internetowe.",
  bad_response: "GOG zwrócił nieprawidłową odpowiedź. Biblioteka nie została zmieniona."
};

/** Stores, not a launcher switcher. No password/2FA input in GameMode Hub. */
export function AccountsPage() {
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

  async function importGog() {
    if (gogBusy) return;
    setGogBusy(true);
    setGogMessage("");
    try {
      const result = await withTimeout(gogImport(), 10000);
      if (!result.ok) {
        setGogMessage(GOG_ERRORS[result.code ?? ""] ?? GOG_ERRORS.unusable);
      } else {
        setGogMessage("Powiązano GOG. Możesz teraz wczytać swoją bibliotekę.");
      }
      await refreshGog();
    } catch {
      setGogMessage("Nie udało się powiązać GOG. Nie zmieniono sesji Unifideck.");
    } finally {
      setGogBusy(false);
    }
  }

  async function unlinkGog() {
    if (gogBusy) return;
    setGogBusy(true);
    setGogMessage("");
    try {
      await withTimeout(gogRemove(), 6000);
      setGames([]);
      setGamesChecked(false);
      setGogMessage("Odłączono GOG od Huba. Sesja Unifideck pozostała bez zmian.");
      await refreshGog();
    } catch {
      setGogMessage("Nie udało się odłączyć GOG od Huba.");
    } finally {
      setGogBusy(false);
    }
  }

  async function loadGogGames() {
    if (gogBusy || !gog?.linked) return;
    setGogBusy(true);
    setGogMessage("");
    try {
      const response = await withTimeout(gogLibrary(), 37000);
      if (response.ok) {
        setGames(response.games);
        setGamesChecked(true);
        setPartial(!!response.partial);
        setGogMessage("Biblioteka GOG została pobrana.");
      } else {
        // A failed or expired token must NOT look like an empty library.
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
            description={gog
              ? GOG_MESSAGES[gog.state]
              : "Sprawdzanie dostępności lokalnej sesji Unifideck…"} />
          <Field label="Sprawdź połączenie"
            description="Odczyt stanu nie uruchamia Unifideck ani nie odszyfrowuje tokenów.">
            <DialogButton disabled={gogBusy} onClick={() => { void refreshGog(); }}>
              Odśwież
            </DialogButton>
          </Field>
          {gog?.can_import && <Field label="Importuj połączenie GOG"
            description="Za Twoją zgodą Hub zweryfikuje szyfrowaną sesję Unifideck. Nie zapisze tokenów w swoich plikach.">
            <DialogButton disabled={gogBusy} onClick={() => { void importGog(); }}>
              {gogBusy ? "Sprawdzanie…" : "Powiąż GOG"}
            </DialogButton>
          </Field>}
          {gog?.linked && <Field label="Biblioteka GOG"
            description="Wczytaj posiadane gry z GOG, bez uruchamiania Heroica i bez zmiany launchera.">
            <DialogButton disabled={gogBusy || gog.state !== "linked"}
              onClick={() => { void loadGogGames(); }}>
              {gogBusy ? "Pobieranie…" : "Wczytaj gry"}
            </DialogButton>
          </Field>}
          {gamesChecked && gog?.linked && <Field label={"Gry GOG: " + games.length + (partial ? "+" : "")}
            description={partial
              ? "Wyświetlamy część biblioteki. Pozostałe gry będą dostępne w przyszłym pełnym widoku sklepu."
              : games.length ? "Biblioteka odczytana z GOG — bez zmian na dysku." : "Brak gier w odpowiedzi GOG."} />}
          {gamesChecked && gog?.linked && games.slice(0, 40).map(game =>
            <Field key={game.id} label={game.title} description={"GOG · " + game.id} />)}
          {gamesChecked && games.length > 40 && <Field label="Pozostałe gry"
            description={"Jeszcze " + (games.length - 40) + " pozycji. Lista jest ograniczona w interfejsie, aby nie obciążać Gaming Mode."} />}
          {gog?.linked && <Field label="Odłącz powiązanie"
            description="Usuwa wyłącznie zgodę Huba. Nie wylogowuje GOG ani Unifideck.">
            <DialogButton disabled={gogBusy} onClick={() => { void unlinkGog(); }}>
              Odłącz GOG
            </DialogButton>
          </Field>}
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
          description="Po zatwierdzeniu powiązania Hub chwilowo odszyfrowuje istniejący plik GOG Unifideck w pamięci. W ustawieniach zapisuje wyłącznie zgodę na powiązanie, nigdy tokeny ani hasło." />
        <Field label="Granice integracji" focusable highlightOnFocus
          description="GOG pozostaje właścicielem konta, Unifideck przechowuje sesję. Hub nie zmienia jej, nie rotuje tokenów i nie wylogowuje Unifideck. Wymagane są testy na Lenovo." />
        <Field label="Szyfrowanie" focusable highlightOnFocus
          description="Szyfrowanie Unifideck wiąże plik z urządzeniem, ale nie zastępuje systemowego sejfu ani nie chroni przed innym procesem tego samego użytkownika." />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

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
const ACCOUNT_OPTIONS = [{ data: "epic", label: "Epic Games" }];

/**
 * Hub intentionally does not collect an Epic username, password, 2FA code,
 * OAuth callback, cookie or token. Login happens in the user-installed
 * launcher; the selector below stores only non-secret UI choices in RAM.
 */
export function AccountsPage() {
  const [selectedAccount, setSelectedAccount] = useHubSessionState<"epic">("accounts.selected", "epic");
  const [selectedLauncherId, setSelectedLauncherId] = useHubSessionState("accounts.epic.launcher", "");
  const [launchers, setLaunchers] = useState<EpicLauncher[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState(false);
  const chosenLauncher = launchers.find(launcher => launcher.app.id === selectedLauncherId) ?? launchers[0];

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const apps = await withTimeout(listDesktopApps(), 12000);
      setLaunchers(identifyEpicLaunchers(apps));
    } catch {
      // Backend error messages may contain local paths; never display them.
      setLaunchers([]);
      setMessage("Nie można sprawdzić zainstalowanych launcherów.");
    } finally {
      setChecked(true);
      setLoading(false);
    }
  }

  useEffect(() => {
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
        <DialogControlsSectionHeader>Konta</DialogControlsSectionHeader>
        <Field label="Wybierz konto"
          description="Lista rozwijana w dół, obsługiwana przyciskiem A i padem. Na razie testujemy wyłącznie Epic Games.">
          <Dropdown rgOptions={ACCOUNT_OPTIONS} selectedOption={selectedAccount}
            onChange={option => {
              if (option.data === "epic") setSelectedAccount("epic");
            }} />
        </Field>
        {selectedAccount === "epic" && <>
          <Field label="Epic Games" focusable highlightOnFocus
            description="Stan sesji: niezweryfikowany. Hub nie czyta tokenów ani nie udaje, że potwierdził zalogowanie." />
          {launchers.length > 1 && <Field label="Launcher do logowania"
            description="Wybierz aplikację, która otworzy własny ekran logowania.">
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
              ? "Przycisk uruchamia " + chosenLauncher.label + ". Hasło i 2FA wpisujesz wyłącznie w tym programie."
              : "Nie znaleziono obsługiwanego launchera. Najpierw zainstaluj go na pulpicie; Hub nie ma własnego formularza hasła."}>
            <DialogButton disabled={loading || opening || !chosenLauncher}
              onClick={() => { void signIn(); }}>
              {opening ? "Uruchamianie…" : "Zaloguj"}
            </DialogButton>
          </Field>
          <Field label="Wykrywanie launcherów"
            description="Sprawdzamy wyłącznie rozpoznane skróty z Pulpitu. Nazwa skrótu nie potwierdza autentyczności programu.">
            <DialogButton disabled={loading || opening} onClick={() => { void refresh(); }}>
              {loading ? "Sprawdzanie…" : "Odśwież"}
            </DialogButton>
          </Field>
          {checked && !loading && !launchers.length && <Field
            label="Brak launchera Epic"
            description="Możesz zainstalować Epic Games Launcher przez Proton w trybie pulpitu. Po instalacji wybierz Odśwież. Samo logowanie na stronie WWW nie podłączy biblioteki do Huba." />}
          {!!message && <Field label="Informacja" description={message} focusable highlightOnFocus />}
        </>}
      </DialogControlsSection>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Bezpieczeństwo konta</DialogControlsSectionHeader>
        <Field label="Hasło, kod 2FA i sesja" focusable highlightOnFocus
          description="Wpisujesz je wyłącznie w zewnętrznym launcherze lub jego stronie logowania. GameMode Hub nie pobiera ani nie zapisuje haseł, tokenów i ciasteczek." />
        <Field label="Magazyn poświadczeń" focusable highlightOnFocus
          description="Za ochronę sesji odpowiada wybrany launcher. Heroic/Legendary i Epic przez Proton nie gwarantują użycia KWallet / sejfu SteamOS. Hub nie deklaruje, że sesja jest w sejfie." />
        <Field label="Dostęp Huba" focusable highlightOnFocus
          description="Odczyt tylko metadanych skrótów .desktop, bez przeglądania katalogów kont, logów, plików auth.json ani danych profilu przeglądarki." />
        <Field label="Wylogowanie i pobieranie" focusable highlightOnFocus
          description="Wylogowanie, instalowanie i aktualizacje gier obsługuje właściwy launcher. Hub nie wysyła poleceń zmieniających konto ani nie pokazuje fikcyjnego postępu." />
        <Field label="Uprawnienia" focusable highlightOnFocus
          description="Bez roota, sudo, haseł systemowych, serwera logowania i skanowania tokenów. Jeśli launcher nie działa, Hub nie próbuje obejść jego zabezpieczeń." />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { GamepadScrollArea } from "./GamepadScrollArea";
import { identifyEpicLaunchers, openEpicLauncher } from "./epicAccountAdapter";
import type { EpicLauncher } from "./epicAccountAdapter";
import type { DesktopApp } from "./DesktopPage";

const listDesktopApps = callable<[], DesktopApp[]>("desktop_list_apps");

/**
 * Intentionally no Epic username, password, 2FA, OAuth callback, cookie,
 * Legendary auth.json, Unifideck RPC or KWallet read path in Hub.
 */
export function AccountsPage() {
  const [launchers, setLaunchers] = useState<EpicLauncher[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState(false);

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const apps = await withTimeout(listDesktopApps(), 12000);
      setLaunchers(identifyEpicLaunchers(apps));
    } catch {
      // Do not expose potentially sensitive process paths or backend errors.
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

  async function open(launcher: EpicLauncher) {
    if (opening) return;
    setOpening(true);
    setMessage("");
    try {
      await openEpicLauncher(launcher);
      setMessage("Uruchomiono launcher. Logowanie i wylogowanie wykonuj tylko w nim.");
    } catch {
      setMessage("Launcher nie uruchomił się w Gaming Mode. Sprawdź skrót w zakładce Pulpit.");
    } finally {
      setOpening(false);
    }
  }

  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Konta — Epic Games (test)</DialogControlsSectionHeader>
        <Field label="Epic Games" focusable highlightOnFocus
          description="Status konta: niezweryfikowany. Hub celowo nie czyta danych uwierzytelniania i nie zgaduje, czy jesteś zalogowany." />
        <Field label="Wykrywanie launcherów"
          description="Wyświetlane są tylko rozpoznane skróty aplikacji z Pulpitu. To nie jest potwierdzenie autentyczności programu ani sesji.">
          <DialogButton disabled={loading || opening} onClick={() => { void refresh(); }}>
            {loading ? "Sprawdzanie…" : "Odśwież"}
          </DialogButton>
        </Field>
        {launchers.map(launcher => <Field key={launcher.app.id}
          label={launcher.label} focusable highlightOnFocus
          description={launcher.provider === "epic"
            ? "Zewnętrzny Epic Games Launcher. Dane logowania pozostają w jego własnym środowisku."
            : "Opcjonalny launcher Heroic/Legendary. Hub nie odczytuje ani nie przenosi jego sesji."}>
          <DialogButton disabled={loading || opening} onClick={() => { void open(launcher); }}>
            {opening ? "Uruchamianie…" : "Otwórz"}
          </DialogButton>
        </Field>)}
        {checked && !loading && !launchers.length && <Field
          label="Nie znaleziono launchera"
          description="Zainstaluj i skonfiguruj launcher w trybie pulpitu. Jeśli istnieje pod inną nazwą, uruchom go przez Pulpit Huba; nie zgadujemy, który skrót jest bezpieczny." />}
        {!!message && <Field label="Informacja" description={message} focusable highlightOnFocus />}
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

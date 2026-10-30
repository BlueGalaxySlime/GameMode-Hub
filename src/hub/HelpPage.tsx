import { useSyncExternalStore } from "react";
import { DialogBody, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { GamepadScrollArea } from "./GamepadScrollArea";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";

/**
 * Compact, read-only help. Keep descriptions tied to features that actually
 * exist, not to planned store/download integrations.
 */
const topics = [
  { title: "Pulpit", description: "Uruchamianie aplikacji systemowych i Flatpak. Szukanie, sortowanie, kategorie, ulubione i ustawienia uruchamiania." },
  { title: "Pliki", description: "Przeglądanie katalogów, ulubione, kopiowanie, przenoszenie, Kosz, nowe foldery oraz transfer przez Wi-Fi. Y otwiera opcje." },
  { title: "Terminal", description: "Powłoka Linux uruchamiana na żądanie; do trzech sesji. LB/RB zmienia sesję, Y otwiera opcje terminala." },
  { title: "Konta", description: "Połączenia sklepów GOG i Epic. Obsługa kont i bibliotek jest testowa; nie wszystkie funkcje sklepów są dostępne." },
  { title: "Opcje Huba", description: "Wspólne ustawienia sesji, klawiatury ekranowej i wyglądu terminala." },
  { title: "Aktualizacje", description: "Sprawdzanie wersji Huba, wybór kanału i instalowanie aktualizacji; dostępna jest także obsługa aktualizacji Flatpak." },
  { title: "Pobieranie", description: "Podgląd zadań instalacji i pobierania obsługiwanych przez Hub." },
  { title: "Optymalizacja", description: "Zakładki gier, ProtonDB oraz karty i kolekcje biblioteki. Przycisk otwiera menu, przełącznik włącza lub wyłącza funkcję." },
  { title: "Podziękowania", description: "Autorzy wykorzystanych projektów i informacje o licencjach." },
  { title: "Zgłoszenia", description: "Przygotowanie opisu błędu i przejście do jego zgłoszenia na GitHubie." },
  { title: "Dodatki", description: "Informacje o powiązanych dodatkach i obsługiwanych integracjach." }
] as const;

const topicsEn = [
  { title: "Desktop", description: "Launch system and Flatpak apps. Search, sort, organize categories and favorites, and adjust launch options." },
  { title: "Files", description: "Browse folders and favorites, copy or move files, use Trash, create folders and transfer files via Wi-Fi. Y opens options." },
  { title: "Terminal", description: "Start a Linux shell on demand with up to three sessions. LB/RB switches sessions, Y opens terminal options." },
  { title: "Accounts", description: "View store connection status for Steam, GOG and Epic. Account and library support is experimental." },
  { title: "Hub Options", description: "Select a language and adjust session, on-screen keyboard and terminal settings." },
  { title: "Updates", description: "Check Hub versions, choose release channels and install updates. Flatpak updates are also supported." },
  { title: "Downloads", description: "Monitor installation and download tasks handled by Hub." },
  { title: "Optimization", description: "Game tabs, ProtonDB, library cards and collections. The button opens a menu; the toggle enables a feature." },
  { title: "Credits", description: "Open-source authors and license details." },
  { title: "Reports", description: "Describe a bug and open a report on GitHub." },
  { title: "Add-ons", description: "Related Decky add-ons and supported integrations." }
] as const;

export function HelpPage() {
  const english = useSyncExternalStore(subscribeHubPreferences, getHubPreferences).language === "en";

  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
        <DialogControlsSectionHeader>{english ? "Help" : "Pomoc"}</DialogControlsSectionHeader>
        {(english ? topicsEn : topics).map(topic =>
          <Field key={topic.title} label={topic.title}
            description={topic.description} focusable highlightOnFocus />
        )}
      </DialogControlsSection>
      <DialogControlsSection>
        <DialogControlsSectionHeader>{english ? "Controls" : "Sterowanie"}</DialogControlsSectionHeader>
        <Field label={english ? "A — select" : "A — wybierz"} description={english ? "Opens the focused item." : "Otwiera zaznaczony element."} focusable />
        <Field label={english ? "Y — options" : "Y — opcje"} description={english ? "Opens actions for the selected file, app or terminal." : "Menu działań dla zaznaczonego pliku, aplikacji lub terminala."} focusable />
        <Field label={english ? "B — back" : "B — wyjdź"} description={english ? "Exits a menu or current mode. In Files and Desktop its behavior depends on focus." : "Wraca z menu lub kończy bieżący tryb. W Plikach i Pulpicie działa zależnie od miejsca."} focusable />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

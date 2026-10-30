import { DialogBody, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { GamepadScrollArea } from "./GamepadScrollArea";

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

export function HelpPage() {
  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Pomoc</DialogControlsSectionHeader>
        {topics.map(topic =>
          <Field key={topic.title} label={topic.title}
            description={topic.description} focusable highlightOnFocus />
        )}
      </DialogControlsSection>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Sterowanie</DialogControlsSectionHeader>
        <Field label="A — wybierz" description="Otwiera zaznaczony element." focusable />
        <Field label="Y — opcje" description="Menu działań dla zaznaczonego pliku, aplikacji lub terminala." focusable />
        <Field label="B — wyjdź" description="Wraca z menu lub kończy bieżący tryb. W Plikach i Pulpicie działa zależnie od miejsca." focusable />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

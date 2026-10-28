import {
  DialogBody, DialogControlsSection, DialogControlsSectionHeader, Field
} from "@decky/ui";
import { GamepadScrollArea } from "./GamepadScrollArea";

type Credit = { project: string; authors: string; reason: string; license: string; source: string };

/** Extend this list as code from more modules is used. */
const reusedCode: Credit[] = [
  {
    project: "Desktop Apps (Decky)",
    authors: "allmazz i współtwórcy",
    reason: "Punkt odniesienia dla wykrywania aplikacji .desktop, integracji Flatpak oraz uruchamiania i zarządzania skrótami Steam. Widok Pulpitu jest autorskim interfejsem GameMode Hub.",
    license: "GPL-3.0", source: "github.com/allmazz/decky-desktop-apps"
  },
  { project: "Decky Terminal", authors: "Alex4386 i współtwórcy", reason: "Technika otwierania natywnej klawiatury SteamOS przez ukryte pole wejściowe.", license: "BSD-3-Clause", source: "github.com/Alex4386/decky-terminal" },
  {
    project: "TabMaster",
    authors: "Travis Lane (Tormak) i współtwórcy",
    reason: "Technika integracji biblioteki Steam zaadaptowana w module Tab Manager.",
    license: "GPL-3.0", source: "github.com/Tormak9970/TabMaster"
  },
  {
    project: "xterm.js i FitAddon",
    authors: "Autorzy xterm.js, SourceLair, Christopher Jeffrey",
    reason: "Emulacja terminala, skalowanie jego okna i zaadaptowane fragmenty stylów.",
    license: "MIT", source: "github.com/xtermjs/xterm.js"
  }
];

const externalProjects: Credit[] = [
  {
    project: "UniFiDeck",
    authors: "mubaraknumann i współtwórcy",
    reason: "Integracja stanu połączeń sklepów poprzez odczyt API wtyczki Decky, bez kopiowania kodu uwierzytelniania i bez dostępu do tokenów.",
    license: "GPL-3.0-or-later", source: "github.com/mubaraknumann/unifideck"
  },
  {
    project: "freedesktop.org / XDG",
    authors: "Społeczność freedesktop.org",
    reason: "Standardy wpisów aplikacji .desktop oraz kosza Trash, z których korzysta Pulpit i Pliki. Własna implementacja obsługi metadanych.",
    license: "Otwarte specyfikacje", source: "specifications.freedesktop.org"
  },
  {
    project: "Decky Loader / @decky/ui",
    authors: "SteamDeckHomebrew i współtwórcy",
    reason: "Natywne kontrolki ustawień i API obecnego adaptera SteamOS.",
    license: "Decky Loader: GPL-2.0",
    source: "github.com/SteamDeckHomebrew/decky-loader"
  },
  {
    project: "Decky Manager — menedżer plików",
    authors: "Ciphay",
    reason: "Zewnętrzna integracja. Kod wtyczki nie został skopiowany.",
    license: "BSD-3-Clause",
    source: "github.com/Ciphay/Decky-File-Manager"
  }
];

function CreditRow({ credit }: { credit: Credit }) {
  return <Field label={credit.project}
    description={credit.authors + " — " + credit.reason + " Licencja: " +
      credit.license + ". Źródło: " + credit.source}
    focusable highlightOnFocus />;
}

export function CreditsPage() {
  return <DialogBody>
    <GamepadScrollArea>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Podziękowania</DialogControlsSectionHeader>
      <Field label="Twórcy oprogramowania open source"
        description="Dziękujemy autorom za pracę wykorzystaną w GameMode Hub. Przesuwaj krzyżak w dół, aby czytać kolejne projekty." focusable />
    </DialogControlsSection>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Wykorzystany lub zaadaptowany kod</DialogControlsSectionHeader>
      {reusedCode.map(credit => <CreditRow key={credit.project} credit={credit} />)}
    </DialogControlsSection>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Platforma i integracje zewnętrzne</DialogControlsSectionHeader>
      {externalProjects.map(credit => <CreditRow key={credit.project} credit={credit} />)}
      <Field label="Pełne licencje" focusable
        description="Warunki licencyjne znajdują się w THIRD_PARTY_NOTICES.md. Sekcja będzie uzupełniana przy dodawaniu modułów." />
    </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

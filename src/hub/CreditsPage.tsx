import { useState } from "react";
import {
  DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field
} from "@decky/ui";

type Credit = { project: string; authors: string; reason: string; license: string; source: string };

/** Extend this list as code from more modules is used. */
const reusedCode: Credit[] = [
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
  const [expanded, setExpanded] = useState(true);
  // Focusable Steam button gives the controller a real navigation target.
  // Moving through credits with D-pad scrolls the dialog with focus.
  return <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <DialogButton onClick={() => setExpanded(value => !value)}
      onOKActionDescription={expanded ? "Zwiń opis" : "Rozwiń opis"}
      style={{ width: "100%", textAlign: "left", minWidth: 0,
        fontWeight: 600, padding: "7px 9px" }}>
      {credit.project + (expanded ? " ▴" : " ▾")}
    </DialogButton>
    {expanded && <div style={{ padding: "1px 8px 12px", fontSize: 12,
      opacity: 0.86, overflowWrap: "anywhere" }}>
      {credit.authors + " — " + credit.reason + " Licencja: " +
        credit.license + ". Źródło: " + credit.source}
    </div>}
  </div>;
}

export function CreditsPage() {
  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Podziękowania</DialogControlsSectionHeader>
      <Field label="Twórcy oprogramowania open source"
        description="Dziękujemy autorom za pracę wykorzystaną w GameMode Hub. Przechodź po projektach krzyżakiem; A rozwija lub zwija szczegóły." />
    </DialogControlsSection>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Wykorzystany lub zaadaptowany kod</DialogControlsSectionHeader>
      {reusedCode.map(credit => <CreditRow key={credit.project} credit={credit} />)}
    </DialogControlsSection>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Platforma i integracje zewnętrzne</DialogControlsSectionHeader>
      {externalProjects.map(credit => <CreditRow key={credit.project} credit={credit} />)}
      <Field label="Pełne licencje" description="Warunki licencyjne znajdują się w THIRD_PARTY_NOTICES.md. Sekcja będzie uzupełniana przy dodawaniu modułów." />
    </DialogControlsSection>
  </DialogBody>;
}

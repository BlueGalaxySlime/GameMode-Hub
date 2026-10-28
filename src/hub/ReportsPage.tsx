import { useState } from "react";
import { DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Field, Navigation } from "@decky/ui";
import { HubTextInput } from "./HubTextInput";
import { useHubSessionState } from "./useHubSessionState";

const ISSUE_URL = "https://github.com/BlueGalaxySlime/GameMode-Hub/issues";
const MAX_TITLE = 110;
const MAX_TEXT = 1200;

/** Never collects logs, IPs, account IDs or tokens; report stays local until
 * user chooses to copy it or explicitly opens GitHub's submission page.
 * GitHub requires login to create issues. No anonymous relay is configured.
 */
export function ReportsPage() {
  const [title, setTitle] = useHubSessionState("reports.title", "");
  const [detail, setDetail] = useHubSessionState("reports.detail", "");
  const [message, setMessage] = useState("");
  const valid = title.trim().length >= 5 && detail.trim().length >= 10;
  const body = "## Problem\n" + detail.trim() +
    "\n\n## Kroki odtworzenia\n(Dopisz, jeśli są potrzebne.)\n\n" +
    "## Środowisko\nGameMode Hub / SteamOS — wersja i urządzenie do uzupełnienia.";
  const issueLink = ISSUE_URL + "/new?title=" +
    encodeURIComponent("[Błąd] " + title.trim()) + "&body=" + encodeURIComponent(body);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText("[Błąd] " + title.trim() + "\n\n" + body);
      setMessage("Raport skopiowany. Możesz wkleić go do zgłoszenia.");
    } catch {
      setMessage("Nie udało się skopiować. Tekst pozostaje w polach.");
    }
  }

  return <DialogBody><DialogControlsSection>
    <DialogControlsSectionHeader>Zgłoszenia błędów</DialogControlsSectionHeader>
    <Field label="Tytuł" description="Opisz krótko, co nie działa.">
      <HubTextInput value={title} placeholder="Np. Nie działa Y w Plikach"
        onChange={event => setTitle(event.target.value.slice(0, MAX_TITLE))} />
    </Field>
    <Field label="Opis i sposób odtworzenia"
      description="Nie wpisuj haseł, kodów parowania, tokenów ani prywatnych adresów.">
      <HubTextInput value={detail} placeholder="Co zrobiłeś i co się stało?"
        onChange={event => setDetail(event.target.value.slice(0, MAX_TEXT))} />
    </Field>
    <Field label="Prywatność" focusable highlightOnFocus
      description="Treść jest tylko w pamięci Huba. Nic nie jest wysyłane automatycznie.
      GitHub wymaga konta do opublikowania zgłoszenia. Anonimowy serwis zgłoszeń
      wymaga jeszcze osobnej bramki antyspamowej." />
    <Field label="Przygotuj zgłoszenie">
      <DialogButton disabled={!valid} onClick={() => { void copyReport(); }}>
        Kopiuj raport
      </DialogButton>
    </Field>
    <Field label="GitHub Issues" description="Otworzy GitHub; przed publikacją potrzebne jest zalogowanie.">
      <DialogButton disabled={!valid} onClick={() => Navigation.NavigateToExternalWeb(issueLink)}>
        Otwórz formularz GitHub
      </DialogButton>
      <DialogButton onClick={() => Navigation.NavigateToExternalWeb(ISSUE_URL)}>
        Przeglądaj istniejące zgłoszenia
      </DialogButton>
    </Field>
    {!!message && <Field label="Stan" description={message} />}
  </DialogControlsSection></DialogBody>;
}

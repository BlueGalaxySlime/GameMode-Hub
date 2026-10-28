import { useState } from "react";
import { DialogBody, DialogButton, DialogControlsSection, Focusable,
  NavEntryPositionPreferences, Navigation } from "@decky/ui";
import { HubTextInput, HubTextArea } from "./HubTextInput";
import { useHubSessionState } from "./useHubSessionState";

const ISSUE_URL = "https://github.com/BlueGalaxySlime/GameMode-Hub/issues";
const MAX_TITLE = 110;
const MAX_TEXT = 1200;

/** No account tokens, report forwarding, or background upload.
 * User chooses when to open GitHub; publishing requires their own login.
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

  return <DialogBody>
    <DialogControlsSection>
      <Focusable flow-children="column" style={{
        display: "flex", flexDirection: "column", width: "100%",
        minWidth: 0, gap: 10, padding: "4px 0"
      }}>
        <div style={{ fontSize: 12, opacity: 0.75, padding: "0 2px" }}>
          Zgłoszenia błędów · GitHub Issues
        </div>
        <HubTextInput value={title} aria-label="Tytuł zgłoszenia"
          placeholder="Tytuł błędu (np. Y nie otwiera menu)…"
          onChange={event => setTitle(event.target.value.slice(0, MAX_TITLE))}
          style={{ padding: "9px 12px" }} />
        <div style={{ minWidth: 0 }}>
          <HubTextArea value={detail} rows={5} maxLength={MAX_TEXT}
            aria-label="Opis błędu i sposób odtworzenia"
            placeholder="Opis błędu: co się stało, co powinno się wydarzyć i jak odtworzyć problem…"
            onChange={event => setDetail(event.target.value.slice(0, MAX_TEXT))} />
          <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right",
            marginTop: 3, paddingRight: 2 }}>
            {detail.length} / {MAX_TEXT} znaków
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, padding: "0 2px" }}>
          Bez haseł, tokenów i danych prywatnych. Raport nie jest wysyłany
          automatycznie; publikacja wymaga zalogowania na GitHubie.
        </div>
        <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexDirection: "row", gap: 8,
            flexWrap: "wrap", width: "100%" }}>
          <DialogButton disabled={!valid} onClick={() => { void copyReport(); }}
            style={{ flex: "1 1 130px", minWidth: 0, padding: "8px" }}>
            Kopiuj raport
          </DialogButton>
          <DialogButton disabled={!valid}
            onClick={() => Navigation.NavigateToExternalWeb(issueLink)}
            style={{ flex: "1 1 160px", minWidth: 0, padding: "8px" }}>
            Zgłoś na GitHub
          </DialogButton>
          <DialogButton onClick={() => Navigation.NavigateToExternalWeb(ISSUE_URL)}
            style={{ flex: "1 1 160px", minWidth: 0, padding: "8px" }}>
            Istniejące zgłoszenia
          </DialogButton>
        </Focusable>
        {!!message && <div role="status" style={{ fontSize: 12, padding: "0 2px" }}>
          {message}
        </div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

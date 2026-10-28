import { useRef, useState } from "react";
import { DialogBody, DialogButton, DialogControlsSection, Focusable,
  NavEntryPositionPreferences, Navigation } from "@decky/ui";
import { HubTextInput, HubTextArea } from "./HubTextInput";
import { useHubSessionState } from "./useHubSessionState";

const ISSUE_URL = "https://github.com/BlueGalaxySlime/GameMode-Hub/issues";
const MAX_TITLE = 110;
const MAX_TEXT = 1200;

/** All data remains local. User must log in to GitHub to publish; no tokens. */
export function ReportsPage() {
  const [title, setTitle] = useHubSessionState("reports.title", "");
  const [detail, setDetail] = useHubSessionState("reports.detail", "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const titleRowRef = useRef<HTMLDivElement>(null);
  const detailRowRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  const valid = title.trim().length >= 5 && detail.trim().length >= 10;
  const body = "## Problem\n" + detail.trim() +
    "\n\n## Kroki odtworzenia\n(Dopisz, jeśli są potrzebne.)\n\n" +
    "## Środowisko\nGameMode Hub / SteamOS — wersja i urządzenie do uzupełnienia.";
  const issueLink = ISSUE_URL + "/new?title=" +
    encodeURIComponent("[Błąd] " + title.trim()) + "&body=" + encodeURIComponent(body);

  function restoreButtonFocus(row: HTMLDivElement | null) {
    window.setTimeout(() => row?.querySelector<HTMLElement>(
      'button, [role="button"], [tabindex]'
    )?.focus({ preventScroll: true }), 0);
  }

  function finishTitle(moveToDescription = false) {
    setEditingTitle(false);
    restoreButtonFocus(moveToDescription ? detailRowRef.current : titleRowRef.current);
  }

  function finishDetail() {
    setEditingDetail(false);
    restoreButtonFocus(detailRowRef.current);
  }

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
      <Focusable flow-children="column"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
        onCancelButton={event => {
          if (!editingTitle && !editingDetail) return;
          event.preventDefault();
          event.stopPropagation();
          if (editingTitle) finishTitle();
          else finishDetail();
        }}
        style={{ display: "flex", flexDirection: "column", width: "100%",
          minWidth: 0, gap: 8, padding: "4px 0" }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Zgłoszenia błędów · GitHub Issues
        </div>
        {/* Like Files/Search: Steam-native focusable row, A enters text editing. */}
        <div ref={titleRowRef} style={{ width: "100%", minWidth: 0 }}>
          {editingTitle ? (
            <HubTextInput value={title} focusOnMount aria-label="Tytuł zgłoszenia"
              placeholder="Tytuł błędu (np. Y nie otwiera menu)…"
              onChange={event => setTitle(event.target.value.slice(0, MAX_TITLE))}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === "Escape" ||
                    event.key === "ArrowDown") {
                  event.preventDefault();
                  event.stopPropagation();
                  finishTitle(event.key === "ArrowDown");
                }
              }} />
          ) : (
            <DialogButton onOKActionDescription="Edytuj tytuł"
              onClick={() => setEditingTitle(true)}
              style={{ width: "100%", minWidth: 0, textAlign: "left" }}>
              {title || "Tytuł błędu (np. Y nie otwiera menu)…"}
            </DialogButton>
          )}
        </div>
        <div ref={detailRowRef} style={{ width: "100%", minWidth: 0 }}>
          {editingDetail ? (
            <HubTextArea value={detail} rows={5} maxLength={MAX_TEXT}
              focusOnMount aria-label="Opis błędu i sposób odtworzenia"
              placeholder="Opis błędu: co się stało i jak odtworzyć problem…"
              onKeyDown={event => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  finishDetail();
                }
              }}
              onChange={event => setDetail(event.target.value.slice(0, MAX_TEXT))} />
          ) : (
            <DialogButton onOKActionDescription="Edytuj opis"
              onClick={() => setEditingDetail(true)}
              style={{ width: "100%", minWidth: 0, textAlign: "left",
                minHeight: 104, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {detail || "Opis błędu: co się stało i jak odtworzyć problem…"}
            </DialogButton>
          )}
          <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right", marginTop: 3 }}>
            {detail.length} / {MAX_TEXT} znaków
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>
          Bez haseł, tokenów i danych prywatnych. Raport nie jest wysyłany
          automatycznie; publikacja wymaga zalogowania na GitHubie.
        </div>
        <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexDirection: "row", gap: 8, width: "100%" }}>
          <DialogButton disabled={!valid} onClick={() => { void copyReport(); }}
            style={{ flex: "1 1 0", minWidth: 0 }}>
            Kopiuj raport
          </DialogButton>
          <DialogButton disabled={!valid}
            onClick={() => Navigation.NavigateToExternalWeb(issueLink)}
            style={{ flex: "1 1 0", minWidth: 0 }}>
            Zgłoś na GitHub
          </DialogButton>
          <DialogButton onClick={() => Navigation.NavigateToExternalWeb(ISSUE_URL)}
            style={{ flex: "1 1 0", minWidth: 0 }}>
            Istniejące zgłoszenia
          </DialogButton>
        </Focusable>
        {!!message && <div role="status" style={{ fontSize: 12 }}>
          {message}
        </div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

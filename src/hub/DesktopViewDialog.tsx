import { useState } from "react";
import { DialogButton, Focusable, ModalRoot, NavEntryPositionPreferences } from "@decky/ui";
import { HubTextInput } from "./HubTextInput";

type Mode = "create" | "rename" | "delete";

export function DesktopViewDialog({ mode, currentName = "", onConfirm, closeModal }: {
  mode: Mode;
  currentName?: string;
  onConfirm: (name: string) => Promise<void>;
  closeModal?: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy || (mode !== "delete" && !name.trim())) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(name.trim());
      closeModal?.();
    } catch (reason) {
      setError("Nie zapisano widoku: " + String(reason));
    } finally {
      setBusy(false);
    }
  }

  const heading = mode === "create" ? "Nowy widok" :
    mode === "rename" ? "Zmień nazwę widoku" : "Usuń własny widok?";

  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12,
      width: "min(86vw, 500px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>{heading}</strong>
      {mode !== "delete" ? (
        <HubTextInput value={name} focusOnMount aria-label="Nazwa własnego widoku"
          placeholder="Nazwa widoku" disabled={busy}
          onEditValue={setName} onExitEdit={() => {}}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); void submit(); }
          }} />
      ) : <div>Widok „{currentName}” zostanie usunięty. Aplikacje i ich ustawienia pozostaną bez zmian.</div>}
      {!!error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
      <Focusable flow-children="row" navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8, width: "100%" }}>
        <DialogButton preferredFocus style={{ flex: "1 1 0" }} disabled={busy}
          onClick={() => closeModal?.()}>Anuluj</DialogButton>
        <DialogButton style={{ flex: "1 1 0" }}
          disabled={busy || (mode !== "delete" && !name.trim())}
          onClick={() => { void submit(); }}>{mode === "delete" ? "Usuń widok" : "Zapisz"}</DialogButton>
      </Focusable>
    </div>
  </ModalRoot>;
}

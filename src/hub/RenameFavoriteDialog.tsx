import { useState } from "react";
import { DialogButton, ModalRoot } from "@decky/ui";
import { HubTextInput } from "./HubTextInput";

/** Changes only the bookmark label, never the folder's name or location. */
export function RenameFavoriteDialog({ label, onSave, closeModal }: {
  label: string;
  onSave: (next: string) => Promise<void>;
  closeModal?: () => void;
}) {
  const [name, setName] = useState(label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const trimmed = name.trim();
    if (busy || !trimmed || trimmed.length > 64) return;
    setBusy(true);
    try {
      await onSave(trimmed);
      closeModal?.();
    } catch (reason) {
      setError("Nie zmieniono nazwy zakładki: " + String(reason));
    } finally {
      setBusy(false);
    }
  }
  return <ModalRoot onCancel={() => { if (!busy) closeModal?.(); }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: 12,
      width: "min(84vw, 460px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Zmień nazwę zakładki</strong>
      <span style={{ fontSize: 12, opacity: 0.8 }}>
        Zmieniasz wyłącznie nazwę w Ulubionych. Ścieżka i pliki pozostają bez zmian.
      </span>
      <HubTextInput value={name} focusOnMount aria-label="Nazwa zakładki"
        onEditValue={setName} disabled={busy} onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); void save(); }
          if (event.key === "Escape") closeModal?.();
        }} />
      {error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
      <DialogButton disabled={busy || !name.trim() || name.trim().length > 64}
        onClick={() => { void save(); }}>Zapisz</DialogButton>
    </div>
  </ModalRoot>;
}

import { useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, ModalRoot } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { HubTextInput } from "./HubTextInput";

const makeFolder = callable<[string, string], { path: string }>("files_mkdir");

export function CreateFolderDialog({ folder, onCreated, closeModal }: {
  folder: string;
  onCreated: () => void;
  closeModal?: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    const proposed = name.trim();
    if (busy || !proposed) return;
    setBusy(true);
    setError("");
    try {
      await withTimeout(makeFolder(folder, proposed), 30000);
      onCreated();
      closeModal?.();
    } catch (reason) {
      setError("Nie udało się utworzyć folderu: " + String(reason));
    } finally {
      setBusy(false);
    }
  }

  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12,
      width: "min(80vw, 480px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Nowy folder</strong>
      <HubTextInput value={name} focusOnMount aria-label="Nazwa nowego folderu"
        placeholder="Wpisz nazwę folderu" disabled={busy}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); void create(); }
        }} />
      {error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
      <DialogButton disabled={busy || !name.trim()} onClick={() => { void create(); }}>
        Utwórz
      </DialogButton>
    </div>
  </ModalRoot>;
}

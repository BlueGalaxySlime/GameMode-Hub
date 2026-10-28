import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, ModalRoot } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";

type TrashEntry = {
  id: string; name: string; path: string; directory: boolean; date: string;
};
const sendToTrash = callable<[string], { id: string; name: string }>("files_trash");
const getTrash = callable<[], TrashEntry[]>("files_trash_list");
const restoreTrash = callable<[string], { path: string }>("files_trash_restore");

export function ConfirmTrashDialog({ path, name, directory, onMoved, closeModal }: {
  path: string; name: string; directory: boolean;
  onMoved: () => void; closeModal?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await withTimeout(sendToTrash(path), 30000);
      onMoved();
      closeModal?.();
    } catch (reason) {
      setError("Nie przeniesiono do Kosza: " + String(reason));
    } finally {
      setBusy(false);
    }
  }
  return <ModalRoot onCancel={() => { if (!busy) closeModal?.(); }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12,
      width: "min(80vw, 480px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Przenieść do Kosza?</strong>
      <div style={{ overflowWrap: "anywhere", fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {directory ? "Folder zostanie przeniesiony wraz z całą zawartością." :
          "Plik będzie można przywrócić z Kosza."}
        {" "}To nie jest trwałe usuwanie. B anuluje.
      </div>
      {error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
      <DialogButton disabled={busy} onClick={() => { void confirm(); }}>
        Przenieś do Kosza
      </DialogButton>
    </div>
  </ModalRoot>;
}

export function TrashListDialog({ onRestored, closeModal }: {
  onRestored: () => void; closeModal?: () => void;
}) {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true);
    void withTimeout(getTrash(), 5000).then(value => {
      if (active) setEntries(value);
    }).catch(reason => {
      if (active) setError("Nie można odczytać Kosza: " + String(reason));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function restore(entry: TrashEntry) {
    if (working) return;
    setWorking(entry.id);
    setError("");
    try {
      await withTimeout(restoreTrash(entry.id), 30000);
      setEntries(old => old.filter(item => item.id !== entry.id));
      onRestored();
    } catch (reason) {
      setError("Nie udało się przywrócić: " + String(reason));
    } finally {
      setWorking(null);
    }
  }

  return <ModalRoot onCancel={() => { if (!working) closeModal?.(); }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12,
      width: "min(86vw, 560px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Kosz</strong>
      <div style={{ fontSize: 12, opacity: 0.8 }}>A przywraca element do poprzedniego miejsca. B zamyka Kosz.</div>
      <div style={{ maxHeight: "min(54vh, 520px)", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(entry => <DialogButton key={entry.id}
          disabled={!!working} onClick={() => { void restore(entry); }}
          style={{ width: "100%", minWidth: 0, textAlign: "left", padding: "7px 9px" }}>
          {entry.directory ? "📁 " : "📄 "}{entry.name}
        </DialogButton>)}
        {!busy && !entries.length && <div style={{ padding: 8, opacity: 0.8 }}>Kosz jest pusty.</div>}
        {busy && <div style={{ padding: 8 }}>Wczytywanie Kosza…</div>}
      </div>
      {error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
    </div>
  </ModalRoot>;
}

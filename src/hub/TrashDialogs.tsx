import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, ModalRoot } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";

type TrashEntry = {
  id: string; name: string; path: string; directory: boolean; date: string;
};
const sendToTrash = callable<[string, boolean], { id: string; name: string }>("files_trash");
const inspectTrash = callable<[string], { protected: boolean; reason: string; path: string }>("files_trash_inspect");
const getTrash = callable<[], TrashEntry[]>("files_trash_list");
const restoreTrash = callable<[string], { path: string }>("files_trash_restore");
const emptyTrash = callable<[boolean], { count: number }>("files_trash_empty");

export function ConfirmTrashDialog({ path, name, directory, onMoved, closeModal }: {
  path: string; name: string; directory: boolean;
  onMoved: () => void; closeModal?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [inspection, setInspection] = useState<{ protected: boolean; reason: string } | null>(null);
  const [extraConfirmation, setExtraConfirmation] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setInspection(null);
    setExtraConfirmation(false);
    void withTimeout(inspectTrash(path), 8000).then(value => {
      if (active) setInspection(value);
    }).catch(reason => {
      if (active) setError("Nie można sprawdzić ścieżki: " + String(reason));
    });
    return () => { active = false; };
  }, [path]);
  async function confirm() {
    if (busy || !inspection) return;
    if (inspection.protected && !extraConfirmation) {
      setExtraConfirmation(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await withTimeout(sendToTrash(path, inspection.protected && extraConfirmation), 30000);
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
      <div style={{ overflowWrap: "anywhere", opacity: 0.8, fontSize: 12 }}>{path}</div>
      {inspection?.protected && <div role="alert" style={{ fontSize: 12, padding: 8,
        border: "1px solid currentColor" }}>
        <strong>Ostrzeżenie: chroniona lokalizacja.</strong> {inspection.reason}
        {extraConfirmation && <div style={{ marginTop: 6, fontWeight: 600 }}>
          Potwierdź świadomie przeniesienie tego elementu i całej jego zawartości do Kosza.
        </div>}
      </div>}
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {directory ? "Folder zostanie przeniesiony wraz z całą zawartością." :
          "Plik będzie można przywrócić z Kosza."}
        {" "}To nie jest trwałe usuwanie. B anuluje.
      </div>
      {error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
      <DialogButton disabled={busy || !inspection} onClick={() => { void confirm(); }}>
        {!inspection ? "Sprawdzanie..." :
          inspection.protected && !extraConfirmation ? "Dalej — pokaż potwierdzenie" :
          inspection.protected ? "Potwierdź przeniesienie chronionego elementu" :
          "Przenieś do Kosza"}
      </DialogButton>
      {extraConfirmation && <DialogButton disabled={busy} onClick={() => setExtraConfirmation(false)}>
        Anuluj
      </DialogButton>}
    </div>
  </ModalRoot>;
}

export function TrashListDialog({ onRestored, closeModal }: {
  onRestored: () => void; closeModal?: () => void;
}) {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
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

  async function emptyAll() {
    if (working || !confirmEmpty) return;
    setWorking("__empty__");
    setError("");
    try {
      await withTimeout(emptyTrash(true), 120000);
      setEntries([]);
      setConfirmEmpty(false);
      onRestored();
    } catch (reason) {
      setError("Nie udało się opróżnić Kosza: " + String(reason));
      try { setEntries(await withTimeout(getTrash(), 5000)); } catch { /* Preserve error. */ }
    } finally {
      setWorking(null);
    }
  }

  return <ModalRoot onCancel={() => {
    if (working) return;
    if (confirmEmpty) setConfirmEmpty(false);
    else closeModal?.();
  }}>
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
      {confirmEmpty && <div role="alert" style={{ border: "1px solid currentColor",
        padding: 8, fontSize: 12 }}>
        <strong>Opróżnienie Kosza jest nieodwracalne.</strong>
        {" "}Usunięte zostaną wszystkie pliki z systemowego Kosza użytkownika,
        także elementy przeniesione tutaj z pulpitu.
      </div>}
      <DialogButton disabled={busy || !!working || entries.length === 0}
        onClick={() => {
          if (confirmEmpty) void emptyAll();
          else setConfirmEmpty(true);
        }}>
        {confirmEmpty ? "Potwierdź trwałe usunięcie wszystkich elementów" : "Opróżnij Kosz"}
      </DialogButton>
      {confirmEmpty && <DialogButton disabled={!!working} onClick={() => setConfirmEmpty(false)}>
        Anuluj
      </DialogButton>}
    </div>
  </ModalRoot>;
}

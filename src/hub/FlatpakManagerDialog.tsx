import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, Focusable, ModalRoot, NavEntryPositionPreferences } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";

type FlatpakApp = {
  id: string; installation: string; origin: string; branch: string;
  version: string; updateable: boolean;
};
type Overview = { apps: FlatpakApp[]; error: string };
const readFlatpaks = callable<[], Overview>("flatpak_overview");
const updateUser = callable<[string], { updated: boolean; id: string }>("flatpak_update_user");
const updateAllUser = callable<[], { updated: boolean }>("flatpak_update_all_user");

/** Read-only for system installations. Only explicitly confirmed --user updates. */
export function FlatpakManagerDialog({ selectedId, bulkRequested = false, onUpdated, closeModal }: {
  selectedId?: string; bulkRequested?: boolean; onUpdated?: () => void;
  closeModal?: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(bulkRequested);
  const working = useRef(false);

  async function refresh() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      setData(await withTimeout(readFlatpaks(), 40000));
    } catch {
      setMessage("Nie udało się odczytać Flatpaków. Bez zmian w systemie.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function update() {
    if (!confirm || working.current) return;
    const app = confirm;
    setConfirm(null);
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await withTimeout(updateUser(app), 245000);
      setMessage("Zaktualizowano " + app + ".");
      onUpdated?.();
      setData(await withTimeout(readFlatpaks(), 40000));
    } catch {
      setMessage("Aktualizacja nie powiodła się. Nie wykonano poleceń root ani sudo.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function updateAll() {
    if (!confirmAll || working.current || !data || data.error) return;
    setConfirmAll(false);
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await withTimeout(updateAllUser(), 245000);
      setMessage("Zaktualizowano Flatpaki użytkownika.");
      onUpdated?.();
      setData(await withTimeout(readFlatpaks(), 40000));
    } catch {
      setMessage("Nie udało się zaktualizować wszystkich Flatpaków użytkownika.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const apps = data?.apps ?? [];
  const chosen = selectedId ? apps.filter(item => item.id === selectedId) : [];
  const visible = chosen.length ? chosen : apps.filter(item => item.updateable);
  const updates = apps.filter(item => item.updateable).length;
  const userUpdates = apps.filter(item => item.updateable && item.installation === "user").length;

  return <ModalRoot onCancel={() => { if (!busy) closeModal?.(); }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12,
      width: "min(88vw, 570px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Flatpak — aktualizacje</strong>
      <div style={{ fontSize: 12 }}>
        Sprawdzanie bez roota. Aktualizacje systemowe tylko do podglądu;
        pojedyncze aplikacje użytkownika można aktualizować po potwierdzeniu.
      </div>
      <div style={{ fontSize: 12 }}>
        {busy ? "Trwa operacja…" : data?.error || ("Zainstalowanych: " + apps.length +
          ". Aktualizacji aplikacji: " + updates + ".")}
      </div>
      <Focusable flow-children="column" style={{ display: "flex", flexDirection: "column",
        gap: 5, maxHeight: "min(46vh, 390px)", overflowY: "auto" }}>
        {visible.slice(0, 70).map(item => <div key={item.id + item.installation}
          style={{ borderBottom: "1px solid #526075", paddingBottom: 5 }}>
          <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>{item.id}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            {item.installation === "user" ? "Użytkownika" : "Systemowy"} ·
            {item.updateable ? " Dostępna aktualizacja" : " Brak wykrytej aktualizacji"}
            {item.version ? " · " + item.version : ""}
          </div>
          {item.updateable && item.installation === "user" && !confirm &&
            <DialogButton disabled={busy} onClick={() => setConfirm(item.id)}>
              Aktualizuj tę aplikację
            </DialogButton>}
        </div>)}
        {!visible.length && !busy &&
          <div style={{ fontSize: 12 }}>Brak dostępnych aktualizacji aplikacji.</div>}
      </Focusable>
      {confirm && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <strong>Aktualizować {confirm}?</strong>
        <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexDirection: "row", gap: 8 }}>
          <DialogButton preferredFocus onClick={() => setConfirm(null)}>Anuluj</DialogButton>
          <DialogButton disabled={busy} onClick={() => { void update(); }}>
            Potwierdź aktualizację
          </DialogButton>
        </Focusable>
      </div>}
      {!selectedId && !confirmAll && userUpdates > 0 &&
        <DialogButton disabled={busy} onClick={() => setConfirmAll(true)}>
          Aktualizuj wszystkie Flatpaki użytkownika ({userUpdates})
        </DialogButton>}
      {confirmAll && !busy && <div style={{ display: "flex",
        flexDirection: "column", gap: 6 }}>
        <strong>Aktualizować wszystkie Flatpaki użytkownika?</strong>
        <div style={{ fontSize: 12 }}>
          {userUpdates} aktualizacji. Systemowe Flatpaki pozostaną bez zmian.
        </div>
        <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexDirection: "row", gap: 8 }}>
          <DialogButton preferredFocus onClick={() => setConfirmAll(false)}>
            Anuluj
          </DialogButton>
          <DialogButton disabled={!data || !!data.error || userUpdates === 0}
            onClick={() => { void updateAll(); }}>
            Potwierdź wszystkie
          </DialogButton>
        </Focusable>
      </div>}
      {!!message && <div role="status" style={{ fontSize: 12 }}>{message}</div>}
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        <DialogButton disabled={busy || !!confirm || confirmAll} onClick={() => { void refresh(); }}>
          Sprawdź ponownie
        </DialogButton>
        <DialogButton disabled={busy} onClick={() => closeModal?.()}>Zamknij</DialogButton>
      </Focusable>
    </div>
  </ModalRoot>;
}

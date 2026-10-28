import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, Focusable, ModalRoot, NavEntryPositionPreferences } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { enqueueFlatpakDownload, useDownloads, isDownloadActive } from "./downloads";

type FlatpakApp = {
  id: string; installation: string; origin: string; branch: string;
  version: string; updateable: boolean;
};
type Overview = { apps: FlatpakApp[]; error: string };
type FlatpakTask = {
  id: number;
  state: "idle" | "preparing" | "running" | "cancelling" |
         "success" | "failed" | "cancelled";
  target: string;
  message: string;
  elapsed: number;
};

const readFlatpaks = callable<[], Overview>("flatpak_overview");
// Updates are owned by the independent Downloads module, not by this dialog.

/** Native Steam controls remain usable while Flatpak updates in the backend.
 * Closing with B never kills the process; only explicit Cancel does that.
 */
export function FlatpakManagerDialog({ selectedId, bulkRequested = false, onUpdated, closeModal }: {
  selectedId?: string; bulkRequested?: boolean; onUpdated?: () => void;
  closeModal?: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [checking, setChecking] = useState(false);
  const { jobs, active } = useDownloads();
  const task = jobs.find(job => isDownloadActive(job)) ?? jobs[0] ?? null;
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; scope: "user" | "system" } | null>(null);
  const [confirmAll, setConfirmAll] = useState(bulkRequested);
  const mounted = useRef(false);
  const checkInFlight = useRef(false);
  const startedTask = useRef(false);
  const lastFinished = useRef(0);

  async function refresh() {
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    if (mounted.current) setChecking(true);
    try {
      const list = await withTimeout(readFlatpaks(), 40000);
      if (mounted.current) setData(list);
    } catch {
      if (mounted.current) setMessage("Nie można sprawdzić dostępnych aktualizacji.");
    } finally {
      checkInFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!task || isDownloadActive(task) || task.id <= lastFinished.current) return;
    lastFinished.current = task.id;
    if (task.state === "success") onUpdated?.();
    void refresh();
  }, [task?.id, task?.state]);

  async function start(target: string | null, scope: "user" | "system") {
    if (startedTask.current || checking) return;
    startedTask.current = true;
    setConfirm(null);
    setConfirmAll(false);
    setMessage("");
    try {
      await enqueueFlatpakDownload(target, scope);
      setMessage("Dodano do Pobierania. Możesz zamknąć okno lub przejść do gry.");
    } catch {
      setMessage("Nie udało się dodać zadania do Pobierania.");
    } finally {
      startedTask.current = false;
    }
  }

  async function startAll() {
    if (startedTask.current || checking || !data || data.error) return;
    const pending = data.apps.filter(item => item.updateable);
    if (!pending.length) return;
    startedTask.current = true;
    setConfirmAll(false);
    setMessage("");
    try {
      const scopes: ("user" | "system")[] = [];
      if (pending.some(item => item.installation === "user")) scopes.push("user");
      if (pending.some(item => item.installation !== "user")) scopes.push("system");
      for (const scope of scopes) await enqueueFlatpakDownload(null, scope);
      setMessage("Dodano aktualizacje do Pobierania. Możesz zamknąć okno.");
    } catch {
      setMessage("Nie dodano wszystkich zadań. Sprawdź zakładkę Pobieranie.");
    } finally {
      startedTask.current = false;
    }
  }

  const apps = data?.apps ?? [];
  const chosen = selectedId ? apps.filter(item => item.id === selectedId) : [];
  const visible = chosen.length ? chosen : apps.filter(item => item.updateable);
  const total = apps.filter(item => item.updateable).length;
  const userUpdates = apps.filter(item =>
    item.updateable && item.installation === "user").length;
  const systemUpdates = apps.filter(item =>
    item.updateable && item.installation !== "user").length;
  const updating = active > 0;

  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12,
      width: "min(88vw, 570px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Flatpak — aktualizacje</strong>
      <div style={{ fontSize: 12 }}>
        Aktualizacje użytkownika i systemowe są uruchamiane w tle.
        Systemowe korzystają z autoryzacji Flatpak/Polkit; bez sudo i hasła w Hubie.
      </div>
      <div role="status" style={{ fontSize: 12 }}>
        {updating
          ? task?.message + " (" + task?.elapsed + " s) — możesz zamknąć okno"
          : checking ? "Sprawdzanie repozytoriów Flatpak…" :
            data?.error || ("Zainstalowanych: " + apps.length +
              ". Dostępne aktualizacje: " + total + ".")}
      </div>
      <Focusable flow-children="column" style={{ display: "flex", flexDirection: "column",
        gap: 5, maxHeight: "min(46vh, 390px)", overflowY: "auto" }}>
        {visible.slice(0, 70).map(item => <div key={item.id + item.installation}
          style={{ borderBottom: "1px solid", paddingBottom: 5 }}>
          <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>{item.id}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            {item.installation === "user" ? "Użytkownika" : "Systemowy"} ·
            {item.updateable ? " Dostępna aktualizacja" : " Brak wykrytej aktualizacji"}
            {item.version ? " · " + item.version : ""}
          </div>
          {item.updateable && !confirm && !confirmAll &&
            <DialogButton disabled={checking}
              onClick={() => setConfirm({
                id: item.id, scope: item.installation === "user" ? "user" : "system"
              })}>
              Aktualizuj tę aplikację
            </DialogButton>}
        </div>)}
        {!visible.length && !checking &&
          <div style={{ fontSize: 12 }}>Brak dostępnych aktualizacji aplikacji.</div>}
      </Focusable>
      {confirm &&
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Aktualizować {confirm.id}?</strong>
          {confirm.scope === "system" && <div style={{ fontSize: 12 }}>
            System może wymagać autoryzacji Polkit. Hub nie prosi o hasło roota.
          </div>}
          <Focusable flow-children="row"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
            style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <DialogButton preferredFocus onClick={() => setConfirm(null)}>Anuluj</DialogButton>
            <DialogButton onClick={() => { void start(confirm.id, confirm.scope); }}>
              Potwierdź aktualizację
            </DialogButton>
          </Focusable>
        </div>}
      {!selectedId && !confirmAll && total > 0 &&
        <DialogButton disabled={checking}
          onClick={() => setConfirmAll(true)}>
          Aktualizuj wszystkie dostępne ({total})
        </DialogButton>}
      {confirmAll && !checking &&
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Aktualizować wszystkie dostępne Flatpaki?</strong>
          <div style={{ fontSize: 12 }}>
            Użytkownika: {userUpdates}. Systemowe: {systemUpdates}.
            Systemowe mogą wymagać autoryzacji Polkit.
          </div>
          <Focusable flow-children="row"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
            style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <DialogButton preferredFocus onClick={() => setConfirmAll(false)}>Anuluj</DialogButton>
            <DialogButton disabled={!data || !!data.error || total === 0}
              onClick={() => { void startAll(); }}>Potwierdź wszystkie</DialogButton>
          </Focusable>
        </div>}
      {!!message && <div role="status" style={{ fontSize: 12 }}>{message}</div>}
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        <DialogButton disabled={checking || !!confirm || confirmAll}
          onClick={() => { void refresh(); }}>Sprawdź ponownie</DialogButton>
        <DialogButton onClick={() => closeModal?.()}>Zamknij</DialogButton>
      </Focusable>
    </div>
  </ModalRoot>;
}

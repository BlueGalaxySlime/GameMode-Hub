import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, Focusable, ModalRoot, NavEntryPositionPreferences } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";

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
const taskStart = callable<[string | null], FlatpakTask>("flatpak_task_start");
const taskStatus = callable<[], FlatpakTask>("flatpak_task_status");
const taskCancel = callable<[], FlatpakTask>("flatpak_task_cancel");
const taskActive = (job: FlatpakTask | null): boolean =>
  !!job && (job.state === "preparing" || job.state === "running" ||
            job.state === "cancelling");

/** Native Steam controls remain usable while Flatpak updates in the backend.
 * Closing with B never kills the process; only explicit Cancel does that.
 */
export function FlatpakManagerDialog({ selectedId, bulkRequested = false, onUpdated, closeModal }: {
  selectedId?: string; bulkRequested?: boolean; onUpdated?: () => void;
  closeModal?: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [checking, setChecking] = useState(false);
  const [task, setTask] = useState<FlatpakTask | null>(null);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
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

  async function poll() {
    try {
      const current = await withTimeout(taskStatus(), 5000);
      if (!mounted.current) return;
      setTask(current);
      if (current.id > lastFinished.current &&
          ["success", "failed", "cancelled"].includes(current.state)) {
        lastFinished.current = current.id;
        setMessage(current.message);
        if (current.state === "success") onUpdated?.();
        void refresh();
      }
    } catch {
      if (mounted.current) setMessage("Nie można odczytać stanu aktualizacji.");
    }
  }

  useEffect(() => {
    mounted.current = true;
    void taskStatus().then(current => {
      if (!mounted.current) return;
      setTask(current);
      lastFinished.current = current.id;
      if (!taskActive(current)) void refresh();
    }).catch(() => { if (mounted.current) void refresh(); });
    const timer = window.setInterval(() => { void poll(); }, 1500);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, []);

  async function start(target: string | null) {
    if (startedTask.current || checking || taskActive(task)) return;
    startedTask.current = true;
    setConfirm(null);
    setConfirmAll(false);
    setMessage("");
    try {
      const started = await withTimeout(taskStart(target), 12000);
      if (mounted.current) setTask(started);
    } catch {
      if (mounted.current) setMessage("Nie uruchomiono aktualizacji. Sprawdź, czy nie trwa inna.");
    } finally {
      startedTask.current = false;
    }
  }

  async function cancel() {
    if (!taskActive(task)) return;
    setMessage("Zlecono anulowanie aktualizacji…");
    try {
      const result = await withTimeout(taskCancel(), 6000);
      if (mounted.current) setTask(result);
    } catch {
      if (mounted.current) setMessage("Nie udało się potwierdzić anulowania.");
    }
  }

  const apps = data?.apps ?? [];
  const chosen = selectedId ? apps.filter(item => item.id === selectedId) : [];
  const visible = chosen.length ? chosen : apps.filter(item => item.updateable);
  const total = apps.filter(item => item.updateable).length;
  const userUpdates = apps.filter(item =>
    item.updateable && item.installation === "user").length;
  const updating = taskActive(task);

  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12,
      width: "min(88vw, 570px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Flatpak — aktualizacje</strong>
      <div style={{ fontSize: 12 }}>
        Systemowe Flatpaki tylko do podglądu. Aktualizacja wszystkich użytkownika
        obejmuje również ich środowiska uruchomieniowe, bez roota.
      </div>
      <div role="status" style={{ fontSize: 12 }}>
        {updating
          ? task?.message + " (" + task?.elapsed + " s)"
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
          {item.updateable && item.installation === "user" && !confirm &&
            <DialogButton disabled={updating || checking}
              onClick={() => setConfirm(item.id)}>
              Aktualizuj tę aplikację
            </DialogButton>}
        </div>)}
        {!visible.length && !checking &&
          <div style={{ fontSize: 12 }}>Brak dostępnych aktualizacji aplikacji.</div>}
      </Focusable>
      {confirm && !updating &&
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Aktualizować {confirm}?</strong>
          <Focusable flow-children="row"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
            style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <DialogButton preferredFocus onClick={() => setConfirm(null)}>Anuluj</DialogButton>
            <DialogButton onClick={() => { void start(confirm); }}>
              Potwierdź aktualizację
            </DialogButton>
          </Focusable>
        </div>}
      {!selectedId && !confirmAll && userUpdates > 0 &&
        <DialogButton disabled={updating || checking}
          onClick={() => setConfirmAll(true)}>
          Aktualizuj wszystkie Flatpaki użytkownika ({userUpdates})
        </DialogButton>}
      {confirmAll && !updating && !checking &&
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Aktualizować wszystkie Flatpaki użytkownika?</strong>
          <Focusable flow-children="row"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
            style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <DialogButton preferredFocus onClick={() => setConfirmAll(false)}>Anuluj</DialogButton>
            <DialogButton disabled={!data || !!data.error || userUpdates === 0}
              onClick={() => { void start(null); }}>Potwierdź wszystkie</DialogButton>
          </Focusable>
        </div>}
      {!!message && <div role="status" style={{ fontSize: 12 }}>{message}</div>}
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        {updating ?
          <DialogButton onClick={() => { void cancel(); }}>Anuluj aktualizację</DialogButton> :
          <DialogButton disabled={checking || !!confirm || confirmAll}
            onClick={() => { void refresh(); }}>Sprawdź ponownie</DialogButton>}
        <DialogButton onClick={() => closeModal?.()}>Zamknij</DialogButton>
      </Focusable>
    </div>
  </ModalRoot>;
}

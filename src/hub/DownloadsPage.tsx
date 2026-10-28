import { useState } from "react";
import { DialogBody, DialogButton, DialogControlsSection, Focusable } from "@decky/ui";
import { cancelDownload, isDownloadActive, useDownloads } from "./downloads";

/** The page never runs or owns downloads: the Python backend does. */
export function DownloadsPage() {
  const { jobs, active, error } = useDownloads();
  const [message, setMessage] = useState("");
  async function cancel(id: number) {
    try {
      await cancelDownload(id);
      setMessage("Wysłano żądanie anulowania.");
    } catch {
      setMessage("Nie udało się anulować zadania.");
    }
  }
  return <DialogBody>
    <DialogControlsSection>
      <Focusable flow-children="column" style={{
        display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0
      }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Pobieranie · {active ? "Aktywne: " + active : "Brak aktywnych zadań"}
        </div>
        {error && <div role="status">{error}</div>}
        {!jobs.length && !error && <div>Brak zadań. Aktualizacje Flatpak pojawią się tutaj.</div>}
        {jobs.map(job => <div key={job.id} style={{
          display: "flex", flexDirection: "column", gap: 4,
          padding: "6px 0", borderBottom: "1px solid"
        }}>
          <strong>{job.label}</strong>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {job.message} {isDownloadActive(job) ? "· " + job.elapsed + " s" : ""}
          </div>
          {isDownloadActive(job) && job.state !== "cancelling" &&
            <DialogButton onClick={() => { void cancel(job.id); }}>
              Anuluj zadanie
            </DialogButton>}
        </div>)}
        {!!message && <div role="status">{message}</div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

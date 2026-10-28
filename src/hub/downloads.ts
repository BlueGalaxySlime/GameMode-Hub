import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { withTimeout } from "../utils/withTimeout";

export type Download = {
  id: number;
  kind: "flatpak";
  target: string;
  scope: "user" | "system";
  label: string;
  state: "queued" | "preparing" | "running" | "cancelling" |
         "success" | "failed" | "cancelled" | "interrupted";
  message: string;
  elapsed: number;
};
export type DownloadsSnapshot = { jobs: Download[]; active: number };

const getDownloads = callable<[], DownloadsSnapshot>("downloads_list");
const enqueue = callable<[string | null, "user" | "system"], Download>("downloads_enqueue_flatpak");
const cancel = callable<[number], DownloadsSnapshot>("downloads_cancel");
export const isDownloadActive = (job: Download) =>
  ["queued", "preparing", "running", "cancelling"].includes(job.state);

export async function enqueueFlatpakDownload(id: string | null, scope: "user" | "system" = "user") {
  return withTimeout(enqueue(id, scope), 8000);
}
export async function cancelDownload(id: number) {
  return withTimeout(cancel(id), 8000);
}

export function useDownloads(interval = 1800) {
  const [data, setData] = useState<DownloadsSnapshot>({ jobs: [], active: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    async function read() {
      if (inFlight) return;
      inFlight = true;
      try {
        const snapshot = await withTimeout(getDownloads(), 6000);
        if (alive) { setData(snapshot); setError(""); }
      } catch {
        if (alive) setError("Stan pobierania jest niedostępny.");
      } finally {
        inFlight = false;
      }
    }
    void read();
    const timer = window.setInterval(() => { void read(); }, interval);
    return () => { alive = false; window.clearInterval(timer); };
  }, [interval]);
  return { ...data, error };
}

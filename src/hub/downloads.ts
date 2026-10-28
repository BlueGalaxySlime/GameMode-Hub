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
  const value = await withTimeout(enqueue(id, scope), 8000);
  window.dispatchEvent(new Event("gamemodehub-downloads-changed"));
  return value;
}
export async function cancelDownload(id: number) {
  const value = await withTimeout(cancel(id), 8000);
  window.dispatchEvent(new Event("gamemodehub-downloads-changed"));
  return value;
}

export function useDownloads(interval = 1800) {
  const [data, setData] = useState<DownloadsSnapshot>({ jobs: [], active: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let working = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      if (!alive || working) return;
      working = true;
      let active = 0;
      try {
        const result = await withTimeout(getDownloads(), 6000);
        active = result.active;
        if (alive) { setData(result); setError(""); }
      } catch {
        if (alive) setError("Stan pobierania jest niedostępny.");
      } finally {
        working = false;
        if (alive) {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => { void load(); }, active ? interval : 30000);
        }
      }
    }
    function changed() {
      if (timeout) clearTimeout(timeout);
      timeout = null;
      void load();
    }
    void load();
    window.addEventListener("gamemodehub-downloads-changed", changed);
    return () => {
      alive = false;
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("gamemodehub-downloads-changed", changed);
    };
  }, [interval]);
  return { ...data, error };
}

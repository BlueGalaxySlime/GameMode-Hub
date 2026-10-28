import { useCallback, useEffect, useState } from "react";
import { callable } from "@decky/api";
import { withTimeout } from "../utils/withTimeout";

export type FlatpakApp = {
  id: string; installation: string; origin: string; branch: string;
  version: string; updateable: boolean;
};
export type FlatpakCheck = {
  state: "never" | "checking" | "ready" | "error";
  checked_at: number | null; next_check_at: number | null;
  stale: boolean; apps: FlatpakApp[]; count: number; error: string;
};
const startCheck = callable<[boolean], FlatpakCheck>("checks_flatpak");
const readStatus = callable<[], FlatpakCheck>("checks_flatpak_status");

/** One check on mount if stale; poll only while check is running. */
export function useFlatpakChecks() {
  const [data, setData] = useState<FlatpakCheck | null>(null);
  const [runId, setRunId] = useState(0);
  const [force, setForce] = useState(false);

  const refresh = useCallback((manual = false) => {
    setForce(manual);
    setRunId(previous => previous + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    async function update(initial: boolean) {
      try {
        const next = await withTimeout(initial ? startCheck(force) : readStatus(), 6000);
        if (!alive) return;
        setData(next);
        if (next.state === "checking") {
          timeout = setTimeout(() => { void update(false); }, 1600);
        }
      } catch {
        if (alive) setData(previous => previous || {
          state: "error", checked_at: null, next_check_at: null,
          stale: true, apps: [], count: 0, error: "Nie można sprawdzić aktualizacji."
        });
      }
    }
    void update(true);
    return () => {
      alive = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [runId, force]);

  return { data, refresh };
}

import { withTimeout } from "../utils/withTimeout";

/**
 * Read-only bridge to the installed UniFiDeck plugin. No credential files,
 * login methods, auth tokens or mutable RPCs are accessed from GameMode Hub.
 */
export type StoreConnectionStatus = {
  id: string; name: string; connected: boolean;
};
const names: Record<string, string> = {
  epic: "Epic Games", gog: "GOG", amazon: "Amazon Games",
  microsoft: "Xbox", ubisoft: "Ubisoft Connect", battlenet: "Battle.net",
  gamevault: "GameVault", itch: "itch.io", steam: "Steam"
};
type BackendAPI = { callable: (method: string) => (...args: unknown[]) => Promise<unknown> };

function unwrap(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "success" in raw && "data" in raw) {
    const envelope = raw as { success: boolean; data: unknown };
    if (!envelope.success) throw new Error("UniFiDeck nie odpowiedział poprawnym statusem.");
    return envelope.data;
  }
  return raw;
}

export async function readUnifideckStatuses(): Promise<StoreConnectionStatus[]> {
  const backend = (window as Window & { DeckyBackend?: BackendAPI }).DeckyBackend;
  if (typeof backend?.callable !== "function") {
    throw new Error("API Decky nie jest dostępne.");
  }
  // Decky Loader has a route to call another plugin's backend. We allow only
  // read-only methods documented by UniFiDeck. Never invoke 'store_auth'.
  const invoke = backend.callable("loader/call_plugin_method");
  const raw = await withTimeout(invoke("Unifideck", "check_store_status"), 10000);
  const rows = unwrap(raw);
  if (!Array.isArray(rows)) throw new Error("UniFiDeck zwrócił nieprawidłową odpowiedź.");
  const statuses: StoreConnectionStatus[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, 40)) {
    if (!row || typeof row !== "object") continue;
    const candidate = row as { store_id?: unknown; available?: unknown };
    if (typeof candidate.store_id !== "string" || !(candidate.store_id in names) ||
        typeof candidate.available !== "boolean" || seen.has(candidate.store_id)) continue;
    seen.add(candidate.store_id);
    statuses.push({
      id: candidate.store_id, name: names[candidate.store_id],
      connected: candidate.available
    });
  }
  return statuses.sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

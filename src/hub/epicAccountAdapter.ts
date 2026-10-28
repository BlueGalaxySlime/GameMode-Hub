/** 
 * Epic account hand-off: GameMode Hub must never act as an Epic OAuth client.
 * These are user-installed desktop applications, NOT verified login sessions.
 * We only use .desktop metadata already exposed by the Desktop module.
 */
import { callable } from "@decky/api";
import { withTimeout } from "../utils/withTimeout";
import {
  createSteamDesktopShortcut, openSteamDesktopShortcut, removeSteamDesktopShortcut
} from "./desktopLaunch";
import type { DesktopApp } from "./DesktopPage";

export type EpicLauncher = {
  app: DesktopApp;
  provider: "epic" | "heroic";
  label: string;
};

const rememberTemporary = callable<[number], number[]>("desktop_remember_temporary");
const forgetTemporary = callable<[number], number[]>("desktop_forget_temporary");

/**
 * Never select a launcher based only on an untrusted .desktop display name.
 * The IDs are hints for a human to inspect, not proof of app authenticity.
 * Unknown shortcuts should be run explicitly via Hub → Pulpit instead.
 */
export function identifyEpicLaunchers(apps: DesktopApp[]): EpicLauncher[] {
  const found: EpicLauncher[] = [];
  const seen = new Set<string>();
  for (const app of apps) {
    if (!app || typeof app.id !== "string" || typeof app.name !== "string" ||
        typeof app.bin !== "string" || typeof app.cmd !== "string" ||
        typeof app.workdir !== "string" || seen.has(app.id)) continue;
    const id = app.id.toLowerCase();
    let provider: EpicLauncher["provider"] | null = null;
    if (["epicgameslauncher", "epic-games-launcher", "com.epicgames.launcher"].includes(id) &&
        /epic games/i.test(app.name)) provider = "epic";
    if (id === "com.heroicgameslauncher.hgl" && /heroic/i.test(app.name) && app.flatpak === true)
      provider = "heroic";
    if (!provider) continue;
    seen.add(app.id);
    found.push({
      app,
      provider,
      label: provider === "epic" ? "Epic Games Launcher" : "Heroic Games Launcher"
    });
  }
  return found.sort((a, b) => (a.provider === "epic" ? 0 : 1) - (b.provider === "epic" ? 0 : 1));
}

/**
 * Only after an explicit user press: use Steam's app runner and the existing
 * temporary-shortcut tracker. Never spawn a shell or invoke auth/CLI endpoints.
 * Steam owns the launched application and its session / credential storage.
 */
export async function openEpicLauncher(launcher: EpicLauncher): Promise<void> {
  if (identifyEpicLaunchers([launcher.app]).length !== 1 ||
      identifyEpicLaunchers([launcher.app])[0].provider !== launcher.provider)
    throw new Error("Nieobsługiwany skrót launchera.");
  const shortcut = await createSteamDesktopShortcut(launcher.app);
  let cleaned = false;
  let recorded = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try { removeSteamDesktopShortcut(shortcut.appId); } catch { /* Steam may have removed it. */ }
    if (recorded) {
      try { await withTimeout(forgetTemporary(shortcut.appId), 4000); }
      catch { /* Retain ID for Desktop's next safe cleanup. */ }
    }
  };
  try {
    // If tracking fails, do not launch an orphan shortcut.
    await withTimeout(rememberTemporary(shortcut.appId), 4000);
    recorded = true;
    const started = await openSteamDesktopShortcut(shortcut.appId, () => { void cleanup(); });
    if (!started) throw new Error("Steam nie potwierdził uruchomienia launchera.");
  } catch (error) {
    await cleanup();
    throw error;
  }
}

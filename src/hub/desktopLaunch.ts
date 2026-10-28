import type { DesktopApp } from "./DesktopPage";

type SteamAppInfo = { display_name?: string; m_gameid: string };
type SteamHost = {
  SteamClient?: {
    Apps: {
      AddShortcut: (name: string, exe: string, startDir: string, launchOptions: string) => Promise<number> | number;
      RemoveShortcut: (id: number) => void;
      SetShortcutName: (id: number, name: string) => void;
      SetShortcutExe: (id: number, exe: string) => void;
      SetShortcutStartDir: (id: number, dir: string) => void;
      SetShortcutLaunchOptions: (id: number, opts: string) => void;
      RunGame: (id: string, args: string, a: number, b: number) => void;
    };
    GameSessions: {
      RegisterForAppLifetimeNotifications: (cb: (event: { unAppID: number; bRunning: boolean }) => void) =>
        { unregister: () => void };
    };
  };
  appStore?: { GetAppOverviewByAppID: (id: number) => SteamAppInfo | null };
};

function host(): Required<SteamHost> {
  const current = window as Window & SteamHost;
  if (!current.SteamClient?.Apps || !current.SteamClient.GameSessions || !current.appStore) {
    throw new Error("Steam nie udostępnia interfejsu uruchamiania w Gaming Mode.");
  }
  return { SteamClient: current.SteamClient, appStore: current.appStore };
}

function delay(ms: number) { return new Promise<void>(resolve => window.setTimeout(resolve, ms)); }

export async function createSteamDesktopShortcut(app: DesktopApp) {
  const client = host();
  // Create the shortcut first, then populate its launch fields; Steam may
  // ignore some properties passed directly to AddShortcut.
  const appId = await Promise.resolve(client.SteamClient.Apps.AddShortcut(app.id, app.id, "", ""));
  if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error("Steam nie utworzył skrótu.");
  try {
    for (let attempt = 0; attempt < 25; attempt++) {
      client.SteamClient.Apps.SetShortcutName(appId, app.name);
      client.SteamClient.Apps.SetShortcutExe(appId, app.bin);
      client.SteamClient.Apps.SetShortcutStartDir(appId, app.workdir);
      client.SteamClient.Apps.SetShortcutLaunchOptions(appId, app.cmd);
      await delay(120);
      const info = client.appStore.GetAppOverviewByAppID(appId);
      if (info?.display_name === app.name && info.m_gameid) {
        return { appId, gameId: info.m_gameid };
      }
    }
    throw new Error("Steam nie potwierdził utworzenia skrótu.");
  } catch (error) {
    try { client.SteamClient.Apps.RemoveShortcut(appId); } catch { /* Steam may already have removed it. */ }
    throw error;
  }
}

export function removeSteamDesktopShortcut(id: number) {
  host().SteamClient.Apps.RemoveShortcut(id);
}

export async function openSteamDesktopShortcut(appId: number, onClosed?: () => void) {
  const client = host();
  const info = client.appStore.GetAppOverviewByAppID(appId);
  if (!info?.m_gameid) throw new Error("Nie znaleziono skrótu w bibliotece Steam.");
  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let observedRunning = false;
    let observedClose = false;
    const subscription = client.SteamClient.GameSessions.RegisterForAppLifetimeNotifications(event => {
      if (event.unAppID !== appId) return;
      if (event.bRunning && !settled) {
        observedRunning = true;
        settled = true;
        resolve(true);
        if (!onClosed) subscription?.unregister();
      } else if (!event.bRunning && observedRunning && !observedClose) {
        observedClose = true;
        subscription?.unregister();
        onClosed?.();
      }
    });
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        subscription?.unregister();
        resolve(false);
      }
    }, 6000);
    try {
      client.SteamClient.Apps.RunGame(info.m_gameid, "", -1, 100);
    } catch (error) {
      if (!settled) {
        settled = true;
        subscription?.unregister();
        window.clearTimeout(timer);
        reject(error);
      }
    }
  });
}

import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Focusable,
  Menu, MenuItem, NavEntryPositionPreferences, showContextMenu
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { useHubSessionState } from "./useHubSessionState";
import {
  createSteamDesktopShortcut, openSteamDesktopShortcut, removeSteamDesktopShortcut
} from "./desktopLaunch";

export type DesktopApp = {
  id: string; name: string; bin: string; cmd: string; workdir: string; flatpak: boolean;
};
type SavedApp = {
  favorite?: boolean; hidden?: boolean; shortcut?: number | null; lastOpened?: number | null;
};
type DesktopState = { apps: Record<string, SavedApp>; temporary: number[] };
type Category = "all" | "favorites" | "flatpak" | "system" | "hidden";

const listDesktopApps = callable<[], DesktopApp[]>("desktop_list_apps");
const readState = callable<[], DesktopState>("desktop_get_state");
const updateSetting = callable<[string, string, boolean | number | null], SavedApp>("desktop_set_setting");
const rememberTemporary = callable<[number], number[]>("desktop_remember_temporary");
const forgetTemporary = callable<[number], number[]>("desktop_forget_temporary");

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "favorites", label: "Ulubione" },
  { key: "flatpak", label: "Flatpak" },
  { key: "system", label: "Systemowe" },
  { key: "hidden", label: "Ukryte" }
];

let staleShortcutsChecked = false;

export function DesktopPage() {
  const [apps, setApps] = useHubSessionState<DesktopApp[]>("desktop.apps", []);
  const [stored, setStored] = useHubSessionState<DesktopState>("desktop.state", { apps: {}, temporary: [] });
  const [category, setCategory] = useHubSessionState<Category>("desktop.category", "all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const [available, state] = await Promise.all([
        withTimeout(listDesktopApps(), 12000), withTimeout(readState(), 4000)
      ]);
      setApps(available);
      setStored(state);
      if (!staleShortcutsChecked) {
        staleShortcutsChecked = true;
        // Remove only temporary shortcuts tracked by THIS plugin after a crash.
        // Never touch user-created or other plugins' Steam shortcuts.
        for (const id of state.temporary) {
          try {
            removeSteamDesktopShortcut(id);
            await withTimeout(forgetTemporary(id), 4000);
          } catch { /* Keep the ID for a later cleanup attempt. */ }
        }
        if (state.temporary.length) setStored(await withTimeout(readState(), 4000));
      }
    } catch (reason) {
      setMessage("Nie można odczytać aplikacji: " + String(reason));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function save(app: DesktopApp, key: string, value: boolean | number | null) {
    const saved = await withTimeout(updateSetting(app.id, key, value), 5000);
    setStored(previous => ({ ...previous, apps: { ...previous.apps, [app.id]: saved } }));
  }

  async function run(app: DesktopApp) {
    if (working) return;
    setWorking(app.id);
    setMessage("");
    let temporaryId: number | null = null;
    try {
      const existing = stored.apps[app.id]?.shortcut;
      void save(app, "lastOpened", Date.now()).catch(() => {});
      if (existing) {
        const opened = await openSteamDesktopShortcut(existing);
        if (!opened) throw new Error("Steam nie potwierdził uruchomienia.");
      } else {
        const temporary = await createSteamDesktopShortcut(app);
        temporaryId = temporary.appId;
        await withTimeout(rememberTemporary(temporary.appId), 4000);
        const cleanup = async () => {
          try { removeSteamDesktopShortcut(temporary.appId); } catch { /* may be gone */ }
          try { await withTimeout(forgetTemporary(temporary.appId), 4000); } catch { /* retry on next visit */ }
        };
        // Steam owns the running process, and the temporary shortcut is deleted on exit.
        const opened = await openSteamDesktopShortcut(temporary.appId, () => { void cleanup(); });
        if (!opened) {
          await cleanup();
          temporaryId = null;
          throw new Error("Steam nie potwierdził uruchomienia.");
        }
      }
    } catch (reason) {
      if (temporaryId !== null) {
        try { removeSteamDesktopShortcut(temporaryId); } catch { /* best effort */ }
        try { await withTimeout(forgetTemporary(temporaryId), 4000); } catch { /* retry */ }
      }
      setMessage("Nie uruchomiono „" + app.name + "”: " + String(reason));
    } finally {
      setWorking(null);
    }
  }

  async function toggleLibrary(app: DesktopApp) {
    if (working) return;
    setWorking(app.id);
    setMessage("");
    try {
      const oldId = stored.apps[app.id]?.shortcut;
      if (oldId) {
        removeSteamDesktopShortcut(oldId);
        await save(app, "shortcut", null);
      } else {
        const shortcut = await createSteamDesktopShortcut(app);
        try {
          await save(app, "shortcut", shortcut.appId);
        } catch (error) {
          removeSteamDesktopShortcut(shortcut.appId);
          throw error;
        }
      }
    } catch (reason) {
      setMessage("Nie udało się zmienić biblioteki Steam: " + String(reason));
    } finally {
      setWorking(null);
    }
  }

  async function toggleFlag(app: DesktopApp, key: "favorite" | "hidden") {
    if (working) return;
    setWorking(app.id);
    setMessage("");
    try {
      await save(app, key, stored.apps[app.id]?.[key] !== true);
    } catch (reason) {
      setMessage("Nie zapisano zmian: " + String(reason));
    } finally {
      setWorking(null);
    }
  }

  function openAppMenu(app: DesktopApp, parent: EventTarget) {
    const prefs = stored.apps[app.id] ?? {};
    showContextMenu(
      <Menu label={app.name}>
        <MenuItem onSelected={() => { void toggleFlag(app, "favorite"); }}>
          {prefs.favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        </MenuItem>
        <MenuItem onSelected={() => { void toggleLibrary(app); }}>
          {prefs.shortcut ? "Usuń z biblioteki Steam" : "Dodaj do biblioteki Steam"}
        </MenuItem>
        <MenuItem onSelected={() => { void toggleFlag(app, "hidden"); }}>
          {prefs.hidden ? "Pokaż" : "Ukryj"}
        </MenuItem>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  const visible = apps.filter(app => {
    const prefs = stored.apps[app.id] ?? {};
    if (category === "hidden") return !!prefs.hidden;
    if (prefs.hidden) return false;
    if (category === "favorites") return !!prefs.favorite;
    if (category === "flatpak") return app.flatpak;
    if (category === "system") return !app.flatpak;
    return true;
  }).sort((a, b) => {
    const pa = stored.apps[a.id] ?? {};
    const pb = stored.apps[b.id] ?? {};
    if (category === "all" && !!pa.favorite !== !!pb.favorite) return pa.favorite ? -1 : 1;
    if (category === "all" && (pa.lastOpened ?? 0) !== (pb.lastOpened ?? 0)) {
      return (pb.lastOpened ?? 0) - (pa.lastOpened ?? 0);
    }
    return a.name.localeCompare(b.name, "pl");
  });

  return <DialogBody>
    <DialogControlsSection>
      <Focusable flow-children="column"
        style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, width: "100%" }}
        onKeyDown={event => {
          if (event.key === "F5") { event.preventDefault(); void refresh(); }
        }}>
        <div aria-label="Stan pulpitu" style={{ display: "flex", gap: 14, flexWrap: "wrap",
          minHeight: 23, alignItems: "center", fontSize: 12, opacity: 0.78 }}>
          <span>Widok: lista</span>
          <span>Aplikacje: {visible.length}</span>
          <span>Sortowanie: {category === "all" ? "ulubione / ostatnie / A–Z" : "A–Z"}</span>
        </div>
        <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          aria-label="Kategorie aplikacji — lewo i prawo"
          style={{ display: "flex", flexDirection: "row", gap: 4, flexWrap: "nowrap",
            overflowX: "auto", overflowY: "hidden", minWidth: 0, width: "100%" }}>
          {categories.map(item => <DialogButton key={item.key}
            onClick={() => { setCategory(item.key); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
            style={{ flex: "0 0 auto", minWidth: 0, padding: "4px 10px", fontSize: 12,
              fontWeight: category === item.key ? 700 : 400,
              background: category === item.key ? "#426b99" : undefined }}>
            {item.label}
          </DialogButton>)}
        </Focusable>
        <div aria-label="Aplikacje pulpitu" ref={scrollRef}
          style={{ minHeight: 160, height: "min(54vh, 540px)", width: "100%",
            overflowY: "auto", overscrollBehavior: "contain", paddingBottom: 36 }}>
          <Focusable flow-children="column"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
            style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            {visible.map(app => <DialogButton key={app.id}
              disabled={!!working || busy}
              onOKActionDescription="Uruchom"
              onOptionsActionDescription="Opcje"
              onOptionsButton={event => openAppMenu(app, event.currentTarget ?? window)}
              onClick={() => { void run(app); }}
              style={{ width: "100%", minWidth: 0, padding: "7px 9px", textAlign: "left" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <span aria-hidden="true">{app.flatpak ? "📦" : "🖥️"}</span>
                <span style={{ flex: "1 1 0", minWidth: 0,
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {app.name}
                </span>
                {stored.apps[app.id]?.favorite && <span aria-label="Ulubiona">★</span>}
                {stored.apps[app.id]?.shortcut && <span style={{ fontSize: 11, opacity: 0.7 }}>Steam</span>}
              </span>
            </DialogButton>)}
            {!busy && !visible.length && <div style={{ padding: 10, opacity: 0.75 }}>
              Brak aplikacji w tej kategorii.
            </div>}
          </Focusable>
        </div>
        {!!message && <div role="status" style={{ fontSize: 12 }}>{message}</div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

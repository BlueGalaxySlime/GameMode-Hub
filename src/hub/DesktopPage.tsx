import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Focusable,
  GamepadButton, Menu, MenuGroup, MenuItem, NavEntryPositionPreferences,
  showContextMenu, showModal
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { useHubSessionState } from "./useHubSessionState";
import { HubTextInput, openHubTextMenu } from "./HubTextInput";
import { effectiveDesktopCategory, filterDesktopApps } from "../core/desktopCatalog";
import { DesktopRulesDialog, ResetDesktopRulesDialog } from "./DesktopRulesDialog";
import { DesktopViewDialog } from "./DesktopViewDialog";
import { FlatpakManagerDialog } from "./FlatpakManagerDialog";
import { useFlatpakChecks } from "./flatpakChecks";
import type { DesktopCategory, DesktopSort } from "../core/desktopCatalog";
import {
  createSteamDesktopShortcut, configureSteamDesktopShortcut, openSteamInputForDesktopShortcut,
  openSteamDesktopShortcut, removeSteamDesktopShortcut, setSteamShortcutDisplayProfile
} from "./desktopLaunch";
import type { DesktopDisplayProfile } from "./desktopLaunch";

export type DesktopApp = {
  id: string; name: string; bin: string; cmd: string; workdir: string; flatpak: boolean;
};
type SavedApp = {
  favorite?: boolean; hidden?: boolean; shortcut?: number | null; lastOpened?: number | null;
  category?: "auto" | "flatpak" | "system"; display_profile?: DesktopDisplayProfile;
};
type CustomView = { id: string; name: string; appIds: string[] };
type DesktopState = { apps: Record<string, SavedApp>; temporary: number[]; views?: CustomView[] };
type Category = DesktopCategory | `custom:${string}`;
type ViewAction = "create" | "rename" | "delete" | "toggle_app";

const listDesktopApps = callable<[], DesktopApp[]>("desktop_list_apps");
const readState = callable<[], DesktopState>("desktop_get_state");
const updateSetting = callable<[string, string, boolean | number | string | null], SavedApp>("desktop_set_setting");
const resetDesktopCategories = callable<[], { reset: number; state: DesktopState }>("desktop_reset_categories");
const editView = callable<[ViewAction, string | null, string | null, string | null],
  { views: CustomView[]; view_id: string }>("desktop_manage_view");
 const rememberTemporary = callable<[number], number[]>("desktop_remember_temporary");
const forgetTemporary = callable<[number], number[]>("desktop_forget_temporary");

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "favorites", label: "Ulubione" },
  { key: "flatpak", label: "Flatpak" },
  { key: "system", label: "Systemowe" },
  { key: "hidden", label: "Ukryte" }
];

const sortOptions: { key: DesktopSort; label: string }[] = [
  { key: "recommended", label: "Ulubione / ostatnie / A–Z" },
  { key: "name-asc", label: "Nazwa A–Z" },
  { key: "name-desc", label: "Nazwa Z–A" },
  { key: "recent", label: "Ostatnio uruchamiane" }
];

let staleShortcutsChecked = false;

export function DesktopPage() {
  const [apps, setApps] = useHubSessionState<DesktopApp[]>("desktop.apps", []);
  const [stored, setStored] = useHubSessionState<DesktopState>("desktop.state", { apps: {}, temporary: [] });
  const [category, setCategory] = useHubSessionState<Category>("desktop.category", "all");
  const [sortMode, setSortMode] = useHubSessionState<DesktopSort>("desktop.sortMode", "recommended");
  const [search, setSearch] = useHubSessionState("desktop.search", "");
  const [editingSearch, setEditingSearch] = useState(false);
  const [selectingSearch, setSelectingSearch] = useState(false);
  const [selectAllSearch, setSelectAllSearch] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchControlRef = useRef<HTMLDivElement>(null);
  const restoreSearchFocusRef = useRef(false);
  const categorySavingRef = useRef(false);
  const rulesModalOpenRef = useRef(false);
  const flatpakModalOpenRef = useRef(false);
  const viewModalOpenRef = useRef(false);
  const { data: flatpakStatus, refresh: checkFlatpakUpdates } = useFlatpakChecks();

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

  async function save(app: DesktopApp, key: string, value: boolean | number | string | null) {
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
        // Saved desktop app shortcuts retain their Steam Input layout.
        // Only their executable/UI-scale options are synchronized.
        configureSteamDesktopShortcut(app, existing, "system", stored.apps[app.id]?.display_profile ?? "default");
        const opened = await openSteamDesktopShortcut(existing);
        if (!opened) throw new Error("Steam nie potwierdził uruchomienia.");
      } else {
        const temporary = await createSteamDesktopShortcut(app, "system", stored.apps[app.id]?.display_profile ?? "default");
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
        const shortcut = await createSteamDesktopShortcut(app, "system", stored.apps[app.id]?.display_profile ?? "default");
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

  async function setDisplayProfile(app: DesktopApp, next: DesktopDisplayProfile) {
    if (working) return;
    setWorking(app.id);
    setMessage("");
    const previous = stored.apps[app.id]?.display_profile ?? "default";
    const shortcutId = stored.apps[app.id]?.shortcut;
    try {
      // Only the chosen shortcut is affected. SteamOS/Gamescope screen size
      // and every other app's resolution remain unchanged.
      if (shortcutId) setSteamShortcutDisplayProfile(shortcutId, next);
      try {
        await save(app, "display_profile", next);
      } catch (error) {
        if (shortcutId) {
          try { setSteamShortcutDisplayProfile(shortcutId, previous); }
          catch { /* Leave Steam's current state and report the error. */ }
        }
        throw error;
      }
      setMessage(next === "default"
        ? "Przywrócono automatyczne dopasowanie obrazu aplikacji."
        : "Zapisano natywny rozmiar obrazu. Sprawdź aplikację po ponownym uruchomieniu.");
    } catch (reason) {
      setMessage("Nie można ustawić dopasowania obrazu: " + String(reason));
    } finally {
      setWorking(null);
    }
  }

  async function openSteamInput(app: DesktopApp) {
    if (working) return;
    setWorking(app.id);
    setMessage("");
    try {
      let id = stored.apps[app.id]?.shortcut;
      if (!id) {
        // Explicit menu action says a persistent Steam shortcut will be
        // created; a temporary shortcut would discard the Steam Input layout.
        const shortcut = await createSteamDesktopShortcut(app, "system", stored.apps[app.id]?.display_profile ?? "default");
        id = shortcut.appId;
        try {
          await save(app, "shortcut", id);
        } catch (error) {
          removeSteamDesktopShortcut(id);
          throw error;
        }
      }
      openSteamInputForDesktopShortcut(id);
    } catch (reason) {
      setMessage("Nie można otworzyć Steam Input: " + String(reason));
      // If a permanent shortcut was saved, leave it intact rather than
      // destroying a potentially configured Steam Input profile.
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

  async function assignCategory(app: DesktopApp, next: "auto" | "flatpak" | "system") {
    if (working || categorySavingRef.current) return;
    categorySavingRef.current = true;
    setWorking(app.id);
    setMessage("");
    try {
      await save(app, "category", next);
      setMessage(next === "auto" ? "Przywrócono automatyczne przypisanie." :
        "Przypisano do: " + (next === "flatpak" ? "Flatpak" : "Systemowe") + ".");
    } catch {
      setMessage("Nie udało się zapisać reguły.");
    } finally {
      categorySavingRef.current = false;
      setWorking(null);
    }
  }

  async function resetCategoryOverrides() {
    if (busy || working || categorySavingRef.current) return;
    categorySavingRef.current = true;
    setBusy(true);
    try {
      const result = await withTimeout(resetDesktopCategories(), 8000);
      setStored(result.state);
      setMessage(result.reset
        ? "Przywrócono automatyczne przypisanie dla " + result.reset + " aplikacji."
        : "Wszystkie przypisania są już automatyczne.");
    } catch (reason) {
      setMessage("Nie udało się zresetować przypisań: " + String(reason));
    } finally {
      categorySavingRef.current = false;
      setBusy(false);
    }
  }

  function openResetRules() {
    // Guard on selection, not after the native Steam menu finishes closing.
    if (rulesModalOpenRef.current) return;
    rulesModalOpenRef.current = true;
    window.setTimeout(() => {
      try {
        const dialog = showModal(
          <ResetDesktopRulesDialog onConfirm={() => { void resetCategoryOverrides(); }} />
        );
        void dialog.ClosedPromise.finally(() => { rulesModalOpenRef.current = false; });
      } catch {
        rulesModalOpenRef.current = false;
        setMessage("Nie udało się otworzyć potwierdzenia resetu.");
      }
    }, 0);
  }

  function openRules() {
    if (rulesModalOpenRef.current) return;
    rulesModalOpenRef.current = true;
    const countFlatpak = apps.filter(app => app.flatpak).length;
    const countOverrides = apps.filter(app =>
      stored.apps[app.id]?.category && stored.apps[app.id].category !== "auto").length;
    window.setTimeout(() => {
      try {
        const dialog = showModal(
          <DesktopRulesDialog automaticFlatpak={countFlatpak} overridden={countOverrides} />
        );
        void dialog.ClosedPromise.finally(() => { rulesModalOpenRef.current = false; });
      } catch {
        rulesModalOpenRef.current = false;
        setMessage("Nie udało się otworzyć reguł widoku.");
      }
    }, 0);
  }

  function openFlatpakManager(selectedId?: string, bulkRequested = false) {
    if (flatpakModalOpenRef.current) return;
    flatpakModalOpenRef.current = true;
    window.setTimeout(() => {
      try {
        const dialog = showModal(<FlatpakManagerDialog selectedId={selectedId}
          bulkRequested={bulkRequested}
          onUpdated={() => { void checkFlatpakUpdates(); }} />);
        void dialog.ClosedPromise.finally(() => { flatpakModalOpenRef.current = false; });
      } catch {
        flatpakModalOpenRef.current = false;
        setMessage("Nie udało się otworzyć menedżera Flatpak.");
      }
    }, 0);
  }

  async function saveView(action: ViewAction, viewId: string | null = null,
                          name: string | null = null, appId: string | null = null) {
    const response = await withTimeout(editView(action, viewId, name, appId), 8000);
    setStored(old => ({ ...old, views: response.views }));
    if (action === "create") changeCategory(`custom:${response.view_id}`);
    if (action === "delete" && category === "custom:" + viewId) changeCategory("all");
  }

  function openViewDialog(mode: "create" | "rename" | "delete", view?: CustomView) {
    if (viewModalOpenRef.current) return;
    viewModalOpenRef.current = true;
    window.setTimeout(() => {
      try {
        const modal = showModal(<DesktopViewDialog mode={mode} currentName={view?.name ?? ""}
          onConfirm={name => saveView(mode, view?.id ?? null, name)} />);
        void modal.ClosedPromise.finally(() => { viewModalOpenRef.current = false; });
      } catch {
        viewModalOpenRef.current = false;
        setMessage("Nie udało się otworzyć edycji widoku.");
      }
    }, 0);
  }

  async function toggleInView(app: DesktopApp, view: CustomView) {
    if (working) return;
    setWorking(app.id);
    try {
      await saveView("toggle_app", view.id, null, app.id);
      setMessage(view.appIds.includes(app.id)
        ? "Usunięto z widoku „" + view.name + "”."
        : "Dodano do widoku „" + view.name + "”.");
    } catch (reason) {
      setMessage("Nie zapisano własnego widoku: " + String(reason));
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
        {app.flatpak && <MenuGroup label="Flatpak">
          <MenuItem onSelected={() => openFlatpakManager(app.id)}>
            Sprawdź / zaktualizuj Flatpak
          </MenuItem>
        </MenuGroup>}
        {!!stored.views?.length && <MenuGroup label="Własne widoki">
          {stored.views.map(view => <MenuItem key={view.id}
            selected={view.appIds.includes(app.id)}
            onSelected={() => { void toggleInView(app, view); }}>
            {view.appIds.includes(app.id) ? "Usuń z: " : "Dodaj do: "}{view.name}
          </MenuItem>)}
        </MenuGroup>}
        <MenuGroup label="Dopasowanie obrazu">
          {([
            { key: "default", label: "Automatyczna" },
            { key: "native", label: "Natywna" }
          ] as const).map(item => <MenuItem key={item.key}
            selected={(prefs.display_profile ?? "default") === item.key}
            onSelected={() => { void setDisplayProfile(app, item.key); }}>
            {item.label}
          </MenuItem>)}
        </MenuGroup>
        <MenuGroup label="Sterowanie padem">
          <MenuItem onSelected={() => { void openSteamInput(app); }}>
            {prefs.shortcut
              ? "Steam Input: szablony / inne gry"
              : "Dodaj do Steam i wybierz układ Steam Input"}
          </MenuItem>
        </MenuGroup>
        <MenuGroup label="Przypisanie">
          {([
            { key: "auto", label: "Automatycznie (" +
              (app.flatpak ? "Flatpak" : "Systemowe") + ")" },
            { key: "flatpak", label: "Flatpak" },
            { key: "system", label: "Systemowe" }
          ] as const).map(item => <MenuItem key={item.key}
            selected={(prefs.category ?? "auto") === item.key}
            onSelected={() => { void assignCategory(app, item.key); }}
            onClick={() => { void assignCategory(app, item.key); }}>
            {item.label}
          </MenuItem>)}
        </MenuGroup>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  function finishSearch() {
    // The Steam TextField is about to unmount. Recover gamepad focus only
    // after React mounts the replacement DialogButton.
    restoreSearchFocusRef.current = true;
    setEditingSearch(false);
    setSelectingSearch(false);
    setSelectAllSearch(false);
  }

  useEffect(() => {
    if (editingSearch || !restoreSearchFocusRef.current) return;
    restoreSearchFocusRef.current = false;
    const timer = window.setTimeout(() => {
      focusSearchBar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingSearch]);

  // B is the native Back action. It exits editing, then backs out of filters.
  // At the catalogue root SteamOS is free to handle B normally.
  function backInDesktop(): boolean {
    if (editingSearch) {
      finishSearch();
    } else if (category !== "all") {
      changeCategory("all");
      setMessage("Widok: Wszystkie.");
    } else if (search) {
      setSearch("");
      setMessage("Wyczyszczono wyszukiwanie.");
    } else {
      return false;
    }
    return true;
  }

  // X is a dedicated focus shortcut, not Back: never clear a search or filter.
  function returnToSearchBar() {
    if (editingSearch) finishSearch();
    else focusSearchBar();
  }

  function focusSearchBar() {
    searchControlRef.current?.querySelector<HTMLElement>(
      'button, [role="button"]'
    )?.focus({ preventScroll: true });
  }

  function changeCategory(next: Category) {
    setCategory(next);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  const currentCustomView = (stored.views ?? []).find(view => category === "custom:" + view.id);

  const hasManualOverrides = Object.values(stored.apps).some(app =>
    app.category === "flatpak" || app.category === "system");

  function openDesktopMenu(parent: EventTarget) {
    showContextMenu(
      <Menu label="Opcje pulpitu">
        <MenuGroup label="Widok">
          {categories.map(item =>
            <MenuItem key={item.key} selected={category === item.key}
              onSelected={() => changeCategory(item.key)}
              onClick={() => changeCategory(item.key)}>{item.label}</MenuItem>)}
        </MenuGroup>
        <MenuGroup label="Własne">
          {(stored.views ?? []).map(view => <MenuItem key={view.id}
            selected={category === "custom:" + view.id}
            onSelected={() => changeCategory(`custom:${view.id}`)}>
            {view.name}
          </MenuItem>)}
          <MenuItem onSelected={() => openViewDialog("create")}>Nowy widok</MenuItem>
          {currentCustomView && <MenuItem onSelected={() => openViewDialog("rename", currentCustomView)}>
            Zmień nazwę własnego
          </MenuItem>}
          {currentCustomView && <MenuItem onSelected={() => openViewDialog("delete", currentCustomView)}>
            Usuń własny widok
          </MenuItem>}
        </MenuGroup>
        <MenuGroup label="Sortowanie">
          {sortOptions.map(item =>
            <MenuItem key={item.key} selected={sortMode === item.key}
              onSelected={() => setSortMode(item.key)}
              onClick={() => setSortMode(item.key)}>{item.label}</MenuItem>)}
        </MenuGroup>
        <MenuGroup label="Reguły widoku">
          <MenuItem onSelected={openRules}>Pokaż reguły</MenuItem>
          <MenuItem disabled={busy || !!working || !hasManualOverrides}
            onSelected={openResetRules}>
            Resetuj do automatycznych
          </MenuItem>
        </MenuGroup>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  const activeCategory = currentCustomView?.name ??
    categories.find(item => item.key === category)?.label ?? "Wszystkie";
  const baseCategory: DesktopCategory = category.startsWith("custom:") ? "all" : category as DesktopCategory;
  const visible = filterDesktopApps(apps, stored.apps, baseCategory, search, sortMode)
    .filter(app => !currentCustomView || currentCustomView.appIds.includes(app.id));

  return <DialogBody>
    <DialogControlsSection>
      <Focusable flow-children="column"
        style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, width: "100%" }}
        onCancelActionDescription={editingSearch ? "Zamknij edycję" : category !== "all" || !!search ? "Cofnij filtr" : "Wstecz"}
        onCancelButton={event => {
          if (event.defaultPrevented) return;
          if (!backInDesktop()) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onSecondaryActionDescription="Wróć do Szukaj"
        onSecondaryButton={event => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          returnToSearchBar();
        }}
        onKeyDown={event => {
          if (event.key === "Escape" && backInDesktop()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (event.key === "F5") { event.preventDefault(); void refresh(); }
        }}>
        <div aria-label="Stan pulpitu" style={{ display: "flex", gap: 14, flexWrap: "wrap",
          minHeight: 23, alignItems: "center", fontSize: 12, opacity: 0.78 }}>
          <span>Widok: lista</span>
          <span>Aplikacje: {visible.length}</span>
          <span>Sortowanie: {sortOptions.find(item => item.key === sortMode)?.label ?? "Nazwa A–Z"}</span>
          <span>Reguły: .desktop / Flatpak + własne przypisania</span>
          <span aria-label="Stan aktualizacji Flatpak">
            {!flatpakStatus || flatpakStatus.state === "never" ? "Aktualizacje: nie sprawdzano" :
              flatpakStatus.state === "checking" ? "Sprawdzanie aktualizacji…" :
              flatpakStatus.state === "error" ? "Nie udało się sprawdzić aktualizacji" :
              flatpakStatus.count ? "Dostępne aktualizacje: " + flatpakStatus.count :
              "Brak aktualizacji"}
          </span>
          {flatpakStatus?.checked_at && <span>
            Sprawdzono: {new Date(flatpakStatus.checked_at * 1000).toLocaleString("pl-PL")}
          </span>}
        </div>
        {/* Read-only context. There is no second action that merely resets to Wszystkie. */}
        <div aria-label="Ścieżka pulpitu" style={{ display: "flex", gap: 6,
          alignItems: "center", minWidth: 0, width: "100%",
          fontSize: 12, opacity: 0.85, padding: "2px 4px" }}>
          <span>Pulpit</span><span aria-hidden="true">›</span>
          <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeCategory}
          </strong>
        </div>
        {/* A edits the search query; Y opens native View / Sort submenus. */}
        <div ref={searchControlRef} onContextMenu={event => {
          event.preventDefault();
          openDesktopMenu(event.currentTarget);
        }}>
          <Focusable flow-children="column"
            navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
            onCancelButton={event => {
              if (event.defaultPrevented || !backInDesktop()) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onButtonDown={event => {
              // Steam TextField sometimes consumes B before the outer handler.
              // Do not swallow B at the root or steal A/Y/navigation.
              if (event.detail.button !== GamepadButton.CANCEL || event.defaultPrevented) return;
              if (!backInDesktop()) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onSecondaryActionDescription="Wróć do Szukaj"
            onSecondaryButton={event => {
              if (event.defaultPrevented) return;
              event.preventDefault();
              event.stopPropagation();
              returnToSearchBar();
            }}
            style={{ width: "100%", minWidth: 0 }}>
          {editingSearch ? (
            <HubTextInput value={search} focusOnMount={!selectingSearch}
              startInSelectionMode={selectingSearch} selectAllOnMount={selectAllSearch}
              aria-label="Szukaj aplikacji" placeholder="Szukaj aplikacji…"
              onEditValue={next => { setSearch(next); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
              onExitEdit={finishSearch}
              onChange={event => {
                setSearch(event.target.value);
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  finishSearch();
                }
              }} />
          ) : (
            <DialogButton preferredFocus onOKActionDescription="Szukaj"
              onCancelActionDescription="Wstecz"
              onCancelButton={event => {
                if (event.defaultPrevented || !backInDesktop()) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onSecondaryActionDescription="Wróć do Szukaj"
              onSecondaryButton={event => {
                if (event.defaultPrevented) return;
                event.preventDefault();
                event.stopPropagation();
                returnToSearchBar();
              }}
              onOptionsActionDescription="Opcje pulpitu"
              onOptionsButton={event => {
                event.preventDefault();
                event.stopPropagation();
                openDesktopMenu(event.currentTarget ?? window);
              }}
              onMenuActionDescription="Edycja tekstu"
              onMenuButton={event => {
                event.preventDefault();
                event.stopPropagation();
                openHubTextMenu({
                  parent: event.currentTarget ?? window,
                  value: search,
                  onEditValue: setSearch,
                  onStartSelection: (all = false) => {
                    setSelectAllSearch(all);
                    setSelectingSearch(true);
                    setEditingSearch(true);
                  }
                });
              }}
              onClick={() => { setSelectingSearch(false); setEditingSearch(true); }}
              style={{ width: "100%", minWidth: 0, textAlign: "left",
                padding: "8px 12px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {search || "Szukaj aplikacji…"}
            </DialogButton>
          )}
          </Focusable>
        </div>
        <div aria-label="Aplikacje pulpitu" data-hub-scroll-container="desktop-list" ref={scrollRef}
          style={{ minHeight: 160, height: "min(54vh, 540px)", width: "100%",
            overflowY: "auto", overscrollBehavior: "contain", paddingBottom: 36 }}>
          <Focusable flow-children="column"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
            style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            {visible.map(app => <DialogButton key={app.id}
              disabled={!!working || busy}
              onOKActionDescription="Uruchom"
              onSecondaryActionDescription="Wróć do Szukaj"
              onSecondaryButton={event => {
                if (event.defaultPrevented) return;
                event.preventDefault();
                event.stopPropagation();
                returnToSearchBar();
              }}
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
                <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>
                  {effectiveDesktopCategory(app, stored.apps[app.id]) === "flatpak" ? "Flatpak" : "System"}
                  {stored.apps[app.id]?.category && stored.apps[app.id].category !== "auto" ? " *" : ""}
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

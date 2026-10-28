import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogButton, DialogControlsSection, Focusable, Menu, MenuGroup, MenuItem, NavEntryPositionPreferences, showContextMenu, showModal } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { breadcrumbs } from "../core/filePath";
import { applyHubPreferences, getHubPreferences, readHubSession, subscribeHubPreferences, writeHubSession } from "../core/hubSession";
import type { HubPreferences } from "../core/hubSession";
import { useHubSessionState } from "./useHubSessionState";
import { HubTextInput } from "./HubTextInput";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { ConfirmTrashDialog, TrashListDialog } from "./TrashDialogs";
import { TransferDialog } from "./TransferDialog";

type SortBy = "name" | "type" | "size" | "date";
type Entry = {
  name: string; path: string; directory: boolean; symlink: boolean;
  size: number | null; modified: number;
};
type DirectoryPage = {
  path: string; parent: string | null;
  roots: { name: string; path: string }[];
  items: Entry[]; total: number; offset: number; limit: number; truncated: boolean;
};
type Clipboard = { paths: string[]; name: string; mode: "copy" | "move" };

const fileList = callable<
  [string | null, boolean, number, SortBy, boolean], DirectoryPage
>("files_list");
const makeFolder = callable<[string, string], { path: string }>("files_mkdir");
const renameFile = callable<[string, string], { path: string }>("files_rename");
const pasteMany = callable<[string[], string, "copy" | "move"], { items: { path: string }[]; count: number }>("files_paste_many");
const readFavorites = callable<[], string[]>("get_favorite_folders");
const saveFavorites = callable<[string[]], string[]>("set_favorite_folders");
const saveHubOptions = callable<[HubPreferences], HubPreferences>("set_hub_preferences");

const sortOptions = [
  { data:"name-asc", label:"Nazwa A–Z", by:"name", descending:false },
  { data:"name-desc", label:"Nazwa Z–A", by:"name", descending:true },
  { data:"type-asc", label:"Typ A–Z", by:"type", descending:false },
  { data:"type-desc", label:"Typ Z–A", by:"type", descending:true },
  { data:"size-asc", label:"Rozmiar ↑", by:"size", descending:false },
  { data:"size-desc", label:"Rozmiar ↓", by:"size", descending:true },
  { data:"date-asc", label:"Data ↑", by:"date", descending:false },
  { data:"date-desc", label:"Data ↓", by:"date", descending:true }
] as const;

function readableSize(size: number | null) {
  if (size === null) return "";
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + " MB";
  return (size / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function favoriteLabel(path: string) {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || "/";
}

function ParentDirectoryRow({ parent, disabled, onOpen }: {
  parent: string | null;
  disabled: boolean;
  onOpen: (path: string) => void;
}) {
  if (!parent) return null;
  return <DialogButton disabled={disabled} aria-label="Katalog wyżej"
    onOKActionDescription="Katalog wyżej"
    style={{ width: "100%", minWidth: 0, textAlign: "left", padding: "7px 9px" }}
    onClick={() => onOpen(parent)}>
    <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <span style={{ fontWeight: 700 }}>...</span>
      <span style={{ fontSize: 12, opacity: 0.75 }}>Katalog wyżej</span>
    </span>
  </DialogButton>;
}

export function FileManagerPage() {
  // Remember the whole browser state across SidebarNavigation tab unmounts.
  // Clipboard and selection are RAM-only, never serialized to disk.
  const [page, setPage] = useHubSessionState<DirectoryPage | null>("files.page", null);
  const [rightPage, setRightPage] = useHubSessionState<DirectoryPage | null>("files.rightPage", null);
  const [activePane, setActivePane] = useHubSessionState<"left" | "right">("files.activePane", "left");
  const [pathDraft, setPathDraft] = useHubSessionState("files.pathDraft", "");
  const [editingPath, setEditingPath] = useHubSessionState("files.editingPath", false);
  const [hidden, setHidden] = useHubSessionState("files.hidden", false);
  const [sortBy, setSortBy] = useHubSessionState<SortBy>("files.sortBy", "name");
  const [descending, setDescending] = useHubSessionState("files.descending", false);
  const [sortMode, setSortMode] = useHubSessionState("files.sortMode", "name-asc");
  const [selected, setSelected] = useHubSessionState<Entry | null>("files.selected", null);
  const [clipboard, setClipboard] = useHubSessionState<Clipboard | null>("files.clipboard", null);
  const [multiSelect, setMultiSelect] = useHubSessionState("files.multiSelect", false);
  const [markedPaths, setMarkedPaths] = useHubSessionState<string[]>("files.markedPaths", []);
  const [favorites, setFavorites] = useHubSessionState<string[]>("files.favorites", []);
  const [savingFavorites, setSavingFavorites] = useState(false);
  const [name, setName] = useHubSessionState("files.name", "");
  const [action, setAction] = useHubSessionState<"folder" | "rename" | null>("files.action", null);
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const splitTree = options.splitFileTree;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingSplit, setSavingSplit] = useState(false);
  const request = useRef(0);
  const activePaneRef = useRef(activePane);
  activePaneRef.current = activePane;
  const currentPane: "left" | "right" = splitTree ? activePane : "left";
  const currentPage = currentPane === "right" ? (rightPage ?? page) : page;

  function activatePane(pane: "left" | "right") {
    if (activePaneRef.current === pane) return;
    activePaneRef.current = pane;
    setActivePane(pane);
    setPathDraft((pane === "right" ? (rightPage ?? page) : page)?.path ?? "");
    setEditingPath(false);
    setSelected(null);
    setAction(null);
  }
  async function changeFavorites(next: string[]) {
    if (savingFavorites) return;
    const previous = favorites;
    setFavorites(next);
    setSavingFavorites(true);
    try {
      setFavorites(await withTimeout(saveFavorites(next), 4000));
      setMessage("");
    } catch (error) {
      setFavorites(previous);
      setMessage("Nie zapisano ulubionych: " + String(error));
    } finally {
      setSavingFavorites(false);
    }
  }

  function toggleMarked(path: string) {
    setMarkedPaths(paths => paths.includes(path)
      ? paths.filter(item => item !== path) : [...paths, path]);
  }

  function startMultiSelect(entry: Entry) {
    setMultiSelect(true);
    setMarkedPaths([entry.path]);
    setAction(null);
    setMessage("Zaznaczaj elementy przyciskiem A. B kończy tryb.");
  }

  function exitMultiSelect() {
    setMultiSelect(false);
    setMarkedPaths([]);
    setMessage("");
  }

  const locked = useRef(false);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const fileScrollRef = useRef<HTMLDivElement>(null);
  const addressControlRef = useRef<HTMLDivElement>(null);
  const filesFocusRef = useRef<HTMLDivElement>(null);
  // A clicked directory is removed from the DOM after navigation. Restore
  // focus inside that SAME pane, otherwise Steam selects the sidebar tab.
  const pendingDirectoryFocus = useRef<"left" | "right" | null>(null);

  function navigateDirectory(path: string, pane: "left" | "right",
    offset = 0, order: SortBy = sortBy, reverse = descending) {
    if (busy || locked.current) return;
    pendingDirectoryFocus.current = pane;
    void load(path, hidden, offset, order, reverse, pane);
  }

  async function changeSplitTree(enabled: boolean) {
    if (savingSplit || enabled === splitTree) return;
    if (enabled && !rightPage && page) setRightPage(page);
    if (!enabled) {
      activePaneRef.current = "left";
      setActivePane("left");
      setPathDraft(page?.path ?? "");
      setEditingPath(false);
    }
    const previous = getHubPreferences();
    const next = applyHubPreferences({ ...previous, splitFileTree: enabled });
    setSavingSplit(true);
    setMessage("");
    try {
      const saved = await withTimeout(saveHubOptions(next), 4000);
      applyHubPreferences(saved);
    } catch {
      applyHubPreferences(previous);
      setMessage("Nie udało się zapisać ustawienia podziału drzewa plików.");
    } finally {
      setSavingSplit(false);
    }
  }

  // Each panel stores its own directory; the single address bar tracks focus.
  async function load(path: string | null, showHidden: boolean,
    offset = 0, order: SortBy = sortBy, reverse = descending,
    pane: "left" | "right" = splitTree ? activePaneRef.current : "left") {
    if (locked.current) return;
    const id = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      const response = await withTimeout(fileList(path, showHidden, offset, order, reverse), 8000);
      if (id !== request.current) return;
      if (!response || !Array.isArray(response.items) || typeof response.path !== "string") {
        throw new Error("Nieprawidłowa odpowiedź systemu plików.");
      }
      const scrollKey = pane === "left" ? "files.treeScrollTop" : "files.listScrollTop";
      const scroll = pane === "left" ? treeScrollRef : fileScrollRef;
      writeHubSession(scrollKey, 0);
      if (scroll.current) scroll.current.scrollTop = 0;
      if (pane === "left") setPage(response);
      else setRightPage(response);
      if (!splitTree || activePaneRef.current === pane) {
        setPathDraft(response.path);
        setEditingPath(false);
      }
      setSelected(null);
      setAction(null);
      setName("");
      setMessage(response.truncated ? "Wyświetlanych jest maksymalnie 1500 elementów." : "");
    } catch (error) {
      if (id !== request.current) return;
      pendingDirectoryFocus.current = null;
      setMessage("Nie można otworzyć folderu: " + String(error));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!page) void load(null, hidden, 0, sortBy, descending, "left");
    void withTimeout(readFavorites(), 4000).then(setFavorites).catch(() => {});
    return () => { request.current++; };
  }, []);

  useEffect(() => {
    if (!page) return;
    if (treeScrollRef.current) treeScrollRef.current.scrollTop = readHubSession("files.treeScrollTop", 0);
    if (fileScrollRef.current) fileScrollRef.current.scrollTop = readHubSession("files.listScrollTop", 0);
  }, [page?.path, page?.offset, rightPage?.path, rightPage?.offset, splitTree]);

  useLayoutEffect(() => {
    if (busy || !pendingDirectoryFocus.current) return;
    const pane = pendingDirectoryFocus.current;
    const container = (pane === "left" ? treeScrollRef : fileScrollRef).current;
    // Prefer a directory entry, then ".." for an empty directory.
    const candidates = container?.querySelectorAll<HTMLElement>(
      '[data-file-entry] [role="button"], [data-file-entry] button, ' +
      '[data-file-entry] [tabindex], [data-parent-row] [role="button"], ' +
      '[data-parent-row] button, [data-parent-row] [tabindex]'
    );
    const target = Array.from(candidates ?? []).find(element =>
      !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true");
    if (target) {
      pendingDirectoryFocus.current = null;
      target.focus({ preventScroll: true });
    }
  }, [busy, page, rightPage, splitTree]);

  // Apply global visibility/sort settings without losing either pane's path.
  async function reloadBoth(showHidden: boolean, order: SortBy, reverse: boolean) {
    await load(page?.path ?? null, showHidden, 0, order, reverse, "left");
    if (splitTree) {
      await load((rightPage ?? page)?.path ?? null, showHidden, 0, order, reverse, "right");
    }
  }

  async function operate(operation: "mkdir" | "rename" | "paste") {
    if (!currentPage || locked.current) return;
    const directory = currentPage;
    const pane = currentPane;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (operation === "mkdir") {
        await withTimeout(makeFolder(directory.path, name), 30000);
      } else if (operation === "rename" && selected) {
        await withTimeout(renameFile(selected.path, name), 30000);
      } else if (operation === "paste" && clipboard) {
        const pasted = await withTimeout(pasteMany(clipboard.paths, directory.path, clipboard.mode), 120000);
        setMessage("Wklejono " + pasted.count + " elementów.");
        setClipboard(null);
      } else {
        return;
      }
      setAction(null);
      setName("");
      setSelected(null);
      const next = await withTimeout(
        fileList(directory.path, hidden, 0, sortBy, descending), 8000
      );
      if (pane === "right") setRightPage(next);
      else setPage(next);
      setPathDraft(next.path);
      if (splitTree && (pane === "right" ? page : rightPage)?.path === directory.path) {
        if (pane === "right") setPage(next);
        else setRightPage(next);
      }
      if (operation !== "paste") setMessage("Gotowe.");
    } catch (error) {
      setMessage("Operacja nie powiodła się: " + String(error));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function clipboardAction(entry: Entry, mode: "copy" | "move") {
    if (entry.symlink) return;
    setClipboard({ paths: [entry.path], name: entry.name, mode });
    setSelected(null);
    setAction(null);
    setMessage("Schowek: " + entry.name);
  }

  function clipboardMarked(mode: "copy" | "move") {
    if (!markedPaths.length) return;
    const count = markedPaths.length;
    setClipboard({ paths: [...markedPaths], name: count + " elementów", mode });
    exitMultiSelect();
    setMessage("Schowek: " + count + " elementów. Wybierz folder docelowy i Wklej.");
  }

  function changeSort(option: typeof sortOptions[number]) {
    setSortMode(option.data);
    setSortBy(option.by);
    setDescending(option.descending);
    void reloadBoth(hidden, option.by, option.descending);
  }

  function changeHidden(show: boolean) {
    if (show === hidden) return;
    setHidden(show);
    void reloadBoth(show, sortBy, descending);
  }

  // A opens the bookmarked directory. Right on that same row opens a single
  // destructive bookmark action; no duplicate list of "Open" / "Remove" rows.
  function openRemoveFavoriteMenu(path: string) {
    showContextMenu(
      <Menu label={favoriteLabel(path)}>
        <MenuItem disabled={savingFavorites}
          onSelected={() => { void changeFavorites(favorites.filter(p => p !== path)); }}>
          Usuń
        </MenuItem>
      </Menu>,
      document.activeElement ?? window,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  async function refreshAfterFolderCreated(folder: string, pane: "left" | "right") {
    try {
      const fresh = await withTimeout(fileList(folder, hidden, 0, sortBy, descending), 8000);
      if (pane === "left" && page?.path === folder) setPage(fresh);
      if (pane === "right" && (rightPage ?? page)?.path === folder) setRightPage(fresh);
      setMessage("Utworzono folder.");
    } catch (error) {
      setMessage("Folder powstał, ale nie udało się odświeżyć listy: " + String(error));
    }
  }

  function openCreateFolderDialog() {
    if (!currentPage) return;
    const folder = currentPage.path;
    const pane = currentPane;
    // Defer until the native Steam menu closes, so the modal receives focus.
    window.setTimeout(() => {
      showModal(<CreateFolderDialog folder={folder}
        onCreated={() => { void refreshAfterFolderCreated(folder, pane); }} />);
    }, 0);
  }

  // Refresh only live panes. Keep the other pane's directory and user session.
  async function refreshAfterTrashOperation() {
    const liveLeft = page?.path;
    const liveRight = splitTree ? (rightPage ?? page)?.path : null;
    try {
      const refreshedLeft = liveLeft
        ? await withTimeout(fileList(liveLeft, hidden, 0, sortBy, descending), 8000)
        : null;
      const refreshedRight = liveRight && liveRight !== liveLeft
        ? await withTimeout(fileList(liveRight, hidden, 0, sortBy, descending), 8000)
        : refreshedLeft;
      if (refreshedLeft) setPage(refreshedLeft);
      if (splitTree && refreshedRight) setRightPage(refreshedRight);
    } catch (error) {
      setMessage("Nie udało się odświeżyć listy: " + String(error));
    }
  }

  function openTransferDialog(selectedFile?: string) {
    // Run once the Steam menu releases controller focus.
    window.setTimeout(() => showModal(<TransferDialog selectedFile={selectedFile} />), 0);
  }

  function openTrashDialog() {
    window.setTimeout(() => showModal(
      <TrashListDialog onRestored={() => {
        setMessage("Przywrócono element z Kosza.");
        void refreshAfterTrashOperation();
      }} />
    ), 0);
  }

  function confirmTrash(entry: Entry) {
    if (entry.symlink || busy) return;
    const target = entry.path;
    window.setTimeout(() => showModal(
      <ConfirmTrashDialog path={target} name={entry.name} directory={entry.directory}
        onMoved={() => {
          if (clipboard?.paths.includes(target)) setClipboard(null);
          setSelected(null);
          setMarkedPaths(paths => paths.filter(path => path !== target));
          setMessage("Przeniesiono do Kosza.");
          void refreshAfterTrashOperation();
        }} />
    ), 0);
  }

  // Native Steam menu, like the existing menu on a folder/file row.
  // MenuGroup opens its choices in a right-hand submenu, as in Gaming Mode.
  function openBrowserMenu(parent: EventTarget) {
    if (busy) return;
    const shortcuts = currentPage?.roots.filter(root => !breadcrumbs(currentPage.path, currentPage.roots)
      .some(part => part.path === root.path)) ?? [];
    showContextMenu(
      <Menu label="Opcje plików">
        <MenuItem disabled={!currentPage} onSelected={openCreateFolderDialog}>Nowy folder...</MenuItem>
        <MenuItem onSelected={openTrashDialog}>Kosz</MenuItem>
        <MenuItem onSelected={() => openTransferDialog()}>Transfer Wi-Fi...</MenuItem>
        <MenuGroup label="Ulubione">
          <MenuItem disabled={!currentPage || savingFavorites ||
            (favorites.length >= 32 && !favorites.includes(currentPage.path))}
            onSelected={() => {
              if (currentPage && !favorites.includes(currentPage.path))
                void changeFavorites([...favorites, currentPage.path]);
            }}>Dodaj</MenuItem>
          {favorites.map(path =>
            <MenuItem key={path}
              onSelected={() => { void load(path, hidden); }}
              onMoveRight={() => openRemoveFavoriteMenu(path)}>
              {favoriteLabel(path)}
            </MenuItem>)}
        </MenuGroup>
        {clipboard && <MenuItem onSelected={() => { void operate("paste"); }}>
          {"Wklej tutaj (" + clipboard.paths.length + ")"}
        </MenuItem>}
        <MenuGroup label="Pokaż ukryte">
          <MenuItem selected={!hidden} onSelected={() => changeHidden(false)}>
            Wyłączone
          </MenuItem>
          <MenuItem selected={hidden} onSelected={() => changeHidden(true)}>
            Włączone
          </MenuItem>
        </MenuGroup>
        <MenuGroup label="Podziel ekran">
          <MenuItem selected={!splitTree} disabled={savingSplit}
            onSelected={() => { void changeSplitTree(false); }}>Wyłączone</MenuItem>
          <MenuItem selected={splitTree} disabled={savingSplit}
            onSelected={() => { void changeSplitTree(true); }}>Włączone</MenuItem>
        </MenuGroup>
        <MenuGroup label="Sortowanie">
          {sortOptions.map(option =>
            <MenuItem key={option.data} selected={sortMode === option.data}
              onSelected={() => changeSort(option)}>
              {option.label}
            </MenuItem>)}
        </MenuGroup>
        {shortcuts.length > 0 &&
          <MenuGroup label="Lokalizacje">
            {shortcuts.map(root =>
              <MenuItem key={root.path} onSelected={() => { void load(root.path, hidden); }}>
                {root.name}
              </MenuItem>)}
          </MenuGroup>}
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  function openFileMenu(entry: Entry, parent: EventTarget, pane: "left" | "right") {
    if (busy || entry.symlink) return;
    activatePane(pane);
    setSelected(entry);
    setAction(null);
    setName(entry.name);
    showContextMenu(
      <Menu label={entry.name}>
        <MenuItem onSelected={() => {
          setSelected(entry);
          setName(entry.name);
          setAction("rename");
        }}>Zmień nazwę</MenuItem>
        <MenuItem onSelected={() => startMultiSelect(entry)}>Zaznacz kilka (B kończy)</MenuItem>
        {multiSelect && markedPaths.length > 0 && <>
          <MenuItem onSelected={() => clipboardMarked("copy")}>
            {"Kopiuj zaznaczone (" + markedPaths.length + ")"}
          </MenuItem>
          <MenuItem onSelected={() => clipboardMarked("move")}>
            {"Przenieś zaznaczone (" + markedPaths.length + ")"}
          </MenuItem>
          <MenuItem onSelected={exitMultiSelect}>Zakończ zaznaczanie</MenuItem>
        </>}
        <MenuItem onSelected={() => clipboardAction(entry, "copy")}>Kopiuj</MenuItem>
        <MenuItem onSelected={() => clipboardAction(entry, "move")}>Przenieś</MenuItem>
        <MenuItem onSelected={() => confirmTrash(entry)}>Przenieś do Kosza</MenuItem>
        {!entry.directory && <MenuItem onSelected={() => openTransferDialog(entry.path)}>
          Udostępnij przez Wi-Fi
        </MenuItem>}
        {entry.directory && clipboard &&
          <MenuItem onSelected={() => { void pasteTo(entry.path); }}>
            {"Wklej do folderu (" + clipboard.paths.length + ")"}
          </MenuItem>}
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  // Files-only fallback if a focused control misses the Y gamepad event.
  // Reuses the existing Steam context menus with all their original actions.
  function openFocusedFilesMenu(parent: EventTarget) {
    if (busy || editingPath) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && filesFocusRef.current?.contains(focused)) {
      const row = focused.closest<HTMLElement>("[data-file-entry]");
      if (row) {
        const pane: "left" | "right" = row.closest<HTMLElement>("[data-file-pane]")
          ?.dataset.filePane === "right" ? "right" : "left";
        const folder = pane === "right" ? (rightPage ?? page) : page;
        const entry = folder?.items.find(item => item.path === row.dataset.filePath);
        if (entry) {
          openFileMenu(entry, focused, pane);
          return;
        }
      }
      openBrowserMenu(focused);
      return;
    }
    openBrowserMenu(parent);
  }

  async function pasteTo(path: string) {
    if (!clipboard || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const pasted = await withTimeout(pasteMany(clipboard.paths, path, clipboard.mode), 120000);
      setClipboard(null);
      setMessage("Wklejono " + pasted.count + " elementów.");
      const fresh = await withTimeout(fileList(path, hidden, 0, sortBy, descending), 8000);
      if (page?.path === path) setPage(fresh);
      if ((rightPage ?? page)?.path === path && splitTree) setRightPage(fresh);
    } catch (error) {
      setMessage("Wklejanie nie powiodło się: " + String(error));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function backInFiles() {
    if (multiSelect) {
      exitMultiSelect();
    } else if (editingPath) {
      setPathDraft(currentPage?.path ?? "");
      setEditingPath(false);
    } else if (currentPage?.parent) {
      navigateDirectory(currentPage.parent, currentPane);
    } else {
      // Root has no parent. Keep the gamepad inside Hub rather than exiting it.
      addressControlRef.current?.querySelector<HTMLElement>(
        'button, [role="button"], [tabindex]'
      )?.focus({ preventScroll: true });
    }
  }

  // SteamOS owns the black footer. Expose controller hints through the
  // focus/navigation API, not duplicate text buttons or a custom footer.
  return <DialogBody>
    <DialogControlsSection>
      <Focusable
        ref={filesFocusRef}
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0 }}
        onOptionsButton={event => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          openFocusedFilesMenu(event.target ?? window);
        }}
        onCancelActionDescription={multiSelect ? "Zakończ zaznaczanie" : editingPath ? "Zamknij edycję" : currentPage?.parent ? "Katalog wyżej" : "Pasek adresu"}
        onCancelButton={event => {
          event.preventDefault();
          event.stopPropagation();
          backInFiles();
        }}
        onKeyDown={event => {
          if (event.key === "Escape" || multiSelect && event.key === "Backspace") {
            event.preventDefault();
            event.stopPropagation();
            backInFiles();
            return;
          }
          if (event.key === "F5") {
            event.preventDefault();
            void load(currentPage?.path ?? null, hidden, currentPage?.offset ?? 0, sortBy, descending, currentPane);
          }
        }}>
        {/* Widok i status na samej górze, przed tagami lokalizacji i paskiem adresu. */}
        <div aria-label="Stan przeglądarki plików"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
            gap: 14, fontSize: 12, opacity: 0.78, minHeight: 23 }}>
          <span>Widok: lista</span>
          <span>Sortowanie: {sortOptions.find(option => option.data === sortMode)?.label ?? "Nazwa A–Z"}</span>
          <span>Ukryte: {hidden ? "widoczne" : "niewidoczne"}</span>
          <span style={{ fontWeight: 700 }}>Podział: {splitTree ? "WŁ." : "WYŁ."}</span>
          {splitTree && <span>Panel: {activePane === "left" ? "lewy" : "prawy"}</span>}
          {multiSelect && <span>Zaznaczanie: {markedPaths.length} (B: wyjdź)</span>}
          {clipboard && <span>Schowek: {clipboard.paths.length}</span>}
        </div>

        {/* Each breadcrumb is a focusable controller target, within allowed roots. */}
        {!!currentPage && <Focusable flow-children="row"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          aria-label="Tagi lokalizacji — lewo i prawo"
          style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap",
            alignItems: "center", gap: 4, minWidth: 0, width: "100%",
            overflowX: "auto", overflowY: "hidden" }}>
          {breadcrumbs(currentPage.path, currentPage.roots).map((part, i) =>
            <div key={part.path} style={{ display: "flex", flex: "0 0 auto",
              gap: 4, alignItems: "center", minWidth: 0 }}>
              {i > 0 && <span style={{ opacity: 0.55 }}>›</span>}
              <DialogButton disabled={busy}
                style={{ minWidth: 0, padding: "3px 9px", fontSize: 12, maxWidth: 190,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onClick={() => {
                  if (part.path !== currentPage.path) navigateDirectory(part.path, currentPane);
                }}>
                <span style={{ fontWeight: part.path === currentPage.path ? 700 : 400 }}>
                  {part.name}
                </span>
              </DialogButton>
            </div>)}
        </Focusable>}

        {/* The one address bar sits immediately above the tree; Y opens its native menu
            used by entries; A enables text editing of the path. */}
        <div ref={addressControlRef} onContextMenu={event => {
          event.preventDefault();
          openBrowserMenu(event.currentTarget);
        }}>
          {editingPath ? (
            <HubTextInput value={pathDraft} placeholder="/home/deck/…"
              aria-label="Edytuj ścieżkę katalogu" focusOnMount
              disabled={busy}
              onChange={event => setPathDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void load(pathDraft, hidden, 0, sortBy, descending, currentPane);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setPathDraft(currentPage?.path ?? "");
                  setEditingPath(false);
                }
              }} />
          ) : (
            <DialogButton disabled={busy}
              onOKActionDescription="Edytuj ścieżkę"
              onOptionsActionDescription="Opcje plików"
              onOptionsButton={event => {
                event.preventDefault();
                event.stopPropagation();
                openBrowserMenu(event.currentTarget ?? window);
              }}
              onClick={() => setEditingPath(true)}
              style={{ width: "100%", minWidth: 0, textAlign: "left",
                padding: "8px 12px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentPage?.path ?? (pathDraft || "/home/deck")}
            </DialogButton>
          )}
        </div>

        {/* Two complete file panels, one shared white address bar above. */}
        {page && <Focusable flow-children={splitTree ? "row" : "column"}
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
          style={{ display: "flex", flexDirection: splitTree ? "row" : "column",
            alignItems: "stretch", gap: splitTree ? 8 : 0,
            width: "100%", minWidth: 0, height: "min(54vh, 540px)",
            minHeight: 160, overflow: "hidden" }}>
          {(["left", "right"] as const).filter(pane => splitTree || pane === "left").map(pane => {
            const folder = pane === "right" ? (rightPage ?? page) : page;
            return <Focusable key={pane} data-file-pane={pane} flow-children="column"
              navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
              onGamepadFocus={() => activatePane(pane)}
              onMouseEnter={() => activatePane(pane)}
              style={{ display: "flex", flexDirection: "column",
                flex: "1 1 0", width: splitTree ? "50%" : "100%",
                minWidth: 0, height: "100%", overflow: "hidden",
                paddingRight: splitTree && pane === "left" ? 6 : 0,
                borderRight: splitTree && pane === "left" ? "1px solid #55677a" : undefined }}>
              <div ref={pane === "left" ? treeScrollRef : fileScrollRef}
                onScroll={event => writeHubSession(
                  pane === "left" ? "files.treeScrollTop" : "files.listScrollTop",
                  event.currentTarget.scrollTop)}
                style={{ minHeight: 0, height: "100%", overflowY: "auto",
                  overscrollBehavior: "contain", display: "flex",
                  flexDirection: "column", gap: 3, paddingBottom: 48 }}>
                <div data-parent-row><ParentDirectoryRow parent={folder.parent} disabled={locked.current}
                  onOpen={parent => {
                    activatePane(pane);
                    navigateDirectory(parent, pane);
                  }} /></div>
                {folder.items.map(entry =>
                  <div key={entry.path} data-file-entry data-file-path={entry.path}
                    style={{ width: "100%", minWidth: 0 }}>
                    {activePane === pane && selected?.path === entry.path && action === "rename" ? (
                      <Focusable flow-children="row"
                        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
                        style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                        <div style={{ flex: "1 1 0", minWidth: 0 }}>
                          <HubTextInput value={name} aria-label="Nowa nazwa"
                            onChange={event => setName(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === "Enter" && name.trim()) {
                                event.preventDefault();
                                void operate("rename");
                              }
                              if (event.key === "Escape") setAction(null);
                            }} />
                        </div>
                        <DialogButton disabled={busy || !name.trim()}
                          style={{ width: "auto", minWidth: 0, padding: "5px 8px" }}
                          onClick={() => void operate("rename")}>✓</DialogButton>
                        <DialogButton disabled={busy}
                          style={{ width: "auto", minWidth: 0, padding: "5px 8px" }}
                          onClick={() => setAction(null)}>×</DialogButton>
                      </Focusable>
                    ) : (
                      <DialogButton disabled={entry.symlink || locked.current}
                        onOKActionDescription={multiSelect ? "Zaznacz / odznacz" : entry.directory ? "Otwórz" : "Zaznacz"}
                        onOptionsActionDescription="Opcje"
                        onOptionsButton={event => {
                           event.preventDefault();
                           event.stopPropagation();
                           openFileMenu(entry, event.currentTarget ?? window, pane);
                         }}
                        onGamepadFocus={() => activatePane(pane)}
                        style={{ width: "100%", minWidth: 0, textAlign: "left",
                          padding: "7px 9px",
                          background: markedPaths.includes(entry.path) ? "#276f65" :
                            activePane === pane && selected?.path === entry.path
                            ? "#426b99" : undefined }}
                        onClick={() => {
                          activatePane(pane);
                          if (multiSelect) {
                            toggleMarked(entry.path);
                          } else if (entry.directory) {
                            navigateDirectory(entry.path, pane);
                          } else {
                            setSelected(entry);
                            setAction(null);
                            setName(entry.name);
                          }
                        }}>
                        <span style={{ display: "flex", gap: 7, alignItems: "center",
                          width: "100%", minWidth: 0 }}>
                          {multiSelect && <span aria-hidden="true">{markedPaths.includes(entry.path) ? "☑" : "☐"}</span>}
                          <span aria-hidden="true">{entry.directory ? "📁" :
                            entry.symlink ? "🔗" : "📄"}</span>
                          <span style={{ flex: 1, minWidth: 0, textAlign: "left",
                            overflow: "hidden", whiteSpace: "nowrap",
                            textOverflow: "ellipsis" }}>{entry.name}</span>
                          {!entry.directory && !entry.symlink &&
                            <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>
                              {readableSize(entry.size)}
                            </span>}
                        </span>
                      </DialogButton>
                    )}
                  </div>)}
                {folder.items.length === 0 && !busy &&
                  <div style={{ opacity: 0.7, padding: 6 }}>Pusty folder</div>}
                {folder.total > folder.limit &&
                  <Focusable flow-children="row"
                    style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    <DialogButton disabled={busy || folder.offset === 0}
                      onClick={() => {
                        activatePane(pane);
                        navigateDirectory(folder.path, pane, Math.max(0, folder.offset - folder.limit));
                      }}>Poprzednia</DialogButton>
                    <span style={{ opacity: 0.75, fontSize: 12 }}>
                      {Math.floor(folder.offset / folder.limit) + 1} / {Math.ceil(folder.total / folder.limit)}
                    </span>
                    <DialogButton disabled={busy || folder.offset + folder.limit >= folder.total}
                      onClick={() => {
                        activatePane(pane);
                        navigateDirectory(folder.path, pane, folder.offset + folder.limit);
                      }}>Następna</DialogButton>
                  </Focusable>}
              </div>
            </Focusable>;
          })}
        </Focusable>}

        {!!message && <div role="status" style={{ fontSize: 12, opacity: 0.8, padding: "2px 3px" }}>
          {message}
        </div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

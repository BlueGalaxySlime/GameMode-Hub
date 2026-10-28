import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogButton, DialogControlsSection, Focusable, Menu, MenuGroup, MenuItem, NavEntryPositionPreferences, showContextMenu, TextField } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { breadcrumbs } from "../core/filePath";
import { applyHubPreferences, getHubPreferences, readHubSession, subscribeHubPreferences, writeHubSession } from "../core/hubSession";
import type { HubPreferences } from "../core/hubSession";
import { useHubSessionState } from "./useHubSessionState";

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
type Clipboard = { path: string; name: string; mode: "copy" | "move" };

const fileList = callable<
  [string | null, boolean, number, SortBy, boolean], DirectoryPage
>("files_list");
const makeFolder = callable<[string, string], { path: string }>("files_mkdir");
const renameFile = callable<[string, string], { path: string }>("files_rename");
const pasteFile = callable<[string, string, "copy" | "move"], { path: string }>("files_paste");
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
  const locked = useRef(false);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const fileScrollRef = useRef<HTMLDivElement>(null);

  async function changeSplitTree(enabled: boolean) {
    if (savingSplit || enabled === splitTree) return;
    if (enabled && !rightPage && page) setRightPage(page);
    if (!enabled) {
      activePaneRef.current = "left";
      setActivePane("left");
      setPathDraft(currentPage?.path ?? "");
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
      setMessage("Nie można otworzyć folderu: " + String(error));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!page) void load(null, hidden, 0, sortBy, descending, "left");
    return () => { request.current++; };
  }, []);

  useEffect(() => {
    if (!page) return;
    if (treeScrollRef.current) treeScrollRef.current.scrollTop = readHubSession("files.treeScrollTop", 0);
    if (fileScrollRef.current) fileScrollRef.current.scrollTop = readHubSession("files.listScrollTop", 0);
  }, [page?.path, page?.offset, rightPage?.path, rightPage?.offset, splitTree]);

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
        await withTimeout(pasteFile(clipboard.path, directory.path, clipboard.mode), 30000);
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
      setMessage("Gotowe.");
    } catch (error) {
      setMessage("Operacja nie powiodła się: " + String(error));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function clipboardAction(entry: Entry, mode: "copy" | "move") {
    if (entry.symlink) return;
    if (entry.directory && mode === "copy") return;
    setClipboard({ path: entry.path, name: entry.name, mode });
    setSelected(null);
    setAction(null);
    setMessage("");
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

  // Native Steam menu, like the existing menu on a folder/file row.
  // MenuGroup opens its choices in a right-hand submenu, as in Gaming Mode.
  function openBrowserMenu(parent: EventTarget) {
    if (busy) return;
    const shortcuts = currentPage?.roots.filter(root => !breadcrumbs(currentPage.path, currentPage.roots)
      .some(part => part.path === root.path)) ?? [];
    showContextMenu(
      <Menu label="Opcje plików" cancelText="Wstecz">
        <MenuItem disabled={!currentPage} onSelected={() => {
          setAction("folder");
          setName("");
          setSelected(null);
          setMessage("");
        }}>Nowy folder...</MenuItem>
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
      <Menu label={entry.name} cancelText="Wstecz">
        <MenuItem onSelected={() => {
          setSelected(entry);
          setName(entry.name);
          setAction("rename");
        }}>Zmień nazwę</MenuItem>
        {!entry.directory &&
          <MenuItem onSelected={() => clipboardAction(entry, "copy")}>Kopiuj</MenuItem>}
        <MenuItem onSelected={() => clipboardAction(entry, "move")}>Przenieś</MenuItem>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  // SteamOS owns the black footer. Expose controller hints through the
  // focus/navigation API, not duplicate text buttons or a custom footer.
  return <DialogBody>
    <DialogControlsSection>
      <Focusable
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0 }}
        onCancelActionDescription={currentPage?.parent ? "W górę" : "Wstecz"}
        onCancelButton={currentPage?.parent ? event => {
          event.preventDefault();
          event.stopPropagation();
          void load(currentPage.parent, hidden, 0, sortBy, descending, currentPane);
        } : undefined}
        onKeyDown={event => {
          if (event.key === "F5") {
            event.preventDefault();
            void load(currentPage?.path ?? null, hidden, currentPage?.offset ?? 0, sortBy, descending, currentPane);
          }
        }}>
        {/* The address bar is directly focusable: Y opens the same native menu
            used by entries; A enables text editing of the path. */}
        <div onContextMenu={event => {
          event.preventDefault();
          openBrowserMenu(event.currentTarget);
        }}>
          {editingPath ? (
            <Focusable flow-children="row"
              navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
              style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <TextField value={pathDraft} placeholder="/home/deck/…"
                  aria-label="Edytuj ścieżkę katalogu"
                  onChange={event => setPathDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void load(pathDraft, hidden);
                    }
                    if (event.key === "Escape") {
                      setPathDraft(currentPage?.path ?? "");
                      setEditingPath(false);
                    }
                  }} />
              </div>
              <DialogButton disabled={busy} onClick={() => { void load(pathDraft, hidden); }}
                style={{ width: "auto", minWidth: 0, padding: "6px 10px" }}>Przejdź</DialogButton>
              <DialogButton disabled={busy} onClick={() => {
                setPathDraft(currentPage?.path ?? "");
                setEditingPath(false);
              }} style={{ width: "auto", minWidth: 0, padding: "6px 10px" }}>Anuluj</DialogButton>
            </Focusable>
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

        {/* Each breadcrumb is a focusable controller target, within allowed roots. */}
        {!!currentPage && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, minWidth: 0 }}>
          {breadcrumbs(currentPage.path, currentPage.roots).map((part, i) =>
            <div key={part.path} style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 0 }}>
              {i > 0 && <span style={{ opacity: 0.55 }}>›</span>}
              <DialogButton disabled={busy || currentPage.path === part.path}
                style={{ minWidth: 0, padding: "3px 9px", fontSize: 12, maxWidth: 190,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onClick={() => void load(part.path, hidden, 0, sortBy, descending, currentPane)}>
                {part.name}
              </DialogButton>
            </div>)}
        </div>}

        {/* Read-only status; commands live in the Y context menu on the path. */}
        <div aria-label="Stan przeglądarki plików"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
            gap: 14, fontSize: 12, opacity: 0.78, minHeight: 23 }}>
          <span>Sortowanie: {sortOptions.find(option => option.data === sortMode)?.label ?? "Nazwa A–Z"}</span>
          <span>Ukryte: {hidden ? "widoczne" : "niewidoczne"}</span>
          <span style={{ fontWeight: 700 }}>Podział: {splitTree ? "WŁ." : "WYŁ."}</span>
          {splitTree && <span>Panel: {activePane === "left" ? "lewy" : "prawy"}</span>}
        </div>

        {action === "folder" && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <TextField value={name} placeholder="Nazwa folderu"
            onChange={event => setName(event.target.value)} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <DialogButton disabled={busy || !name.trim()}
              onClick={() => { void operate("mkdir"); }}>Utwórz</DialogButton>
            <DialogButton disabled={busy} onClick={() => setAction(null)}>Anuluj</DialogButton>
          </div>
        </div>}
        {clipboard && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, opacity: 0.75, overflowWrap: "anywhere" }}>
            {clipboard.mode === "copy" ? "Kopiuj: " : "Przenieś: "}{clipboard.name}
          </span>
          <DialogButton disabled={busy || !currentPage} onClick={() => { void operate("paste"); }}>
            Wklej
          </DialogButton>
          <DialogButton disabled={busy} onClick={() => { setClipboard(null); setMessage(""); }}>
            Anuluj
          </DialogButton>
        </div>}

        {/* Two complete file panels, one shared white address bar above. */}
        {page && <Focusable flow-children={splitTree ? "row" : "column"}
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
          style={{ display: "flex", flexDirection: splitTree ? "row" : "column",
            alignItems: "stretch", gap: splitTree ? 8 : 0,
            width: "100%", minWidth: 0, height: "min(54vh, 540px)",
            minHeight: 160, overflow: "hidden" }}>
          {(["left", "right"] as const).filter(pane => splitTree || pane === "left").map(pane => {
            const folder = pane === "right" ? (rightPage ?? page) : page;
            return <Focusable key={pane} flow-children="column"
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
                <ParentDirectoryRow parent={folder.parent} disabled={busy}
                  onOpen={parent => {
                    activatePane(pane);
                    void load(parent, hidden, 0, sortBy, descending, pane);
                  }} />
                {folder.items.map(entry =>
                  <div key={entry.path} style={{ width: "100%", minWidth: 0 }}>
                    {activePane === pane && selected?.path === entry.path && action === "rename" ? (
                      <Focusable flow-children="row"
                        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
                        style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                        <div style={{ flex: "1 1 0", minWidth: 0 }}>
                          <TextField value={name} aria-label="Nowa nazwa"
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
                      <DialogButton disabled={busy || entry.symlink}
                        onOKActionDescription={entry.directory ? "Otwórz" : "Zaznacz"}
                        onOptionsActionDescription="Opcje"
                        onOptionsButton={event => openFileMenu(entry, event.currentTarget ?? window, pane)}
                        onGamepadFocus={() => activatePane(pane)}
                        style={{ width: "100%", minWidth: 0, textAlign: "left",
                          padding: "7px 9px",
                          background: activePane === pane && selected?.path === entry.path
                            ? "#426b99" : undefined }}
                        onClick={() => {
                          activatePane(pane);
                          if (entry.directory) {
                            void load(entry.path, hidden, 0, sortBy, descending, pane);
                          } else {
                            setSelected(entry);
                            setAction(null);
                            setName(entry.name);
                          }
                        }}>
                        <span style={{ display: "flex", gap: 7, alignItems: "center",
                          width: "100%", minWidth: 0 }}>
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
                        void load(folder.path, hidden, Math.max(0, folder.offset - folder.limit),
                          sortBy, descending, pane);
                      }}>Poprzednia</DialogButton>
                    <span style={{ opacity: 0.75, fontSize: 12 }}>
                      {Math.floor(folder.offset / folder.limit) + 1} / {Math.ceil(folder.total / folder.limit)}
                    </span>
                    <DialogButton disabled={busy || folder.offset + folder.limit >= folder.total}
                      onClick={() => {
                        activatePane(pane);
                        void load(folder.path, hidden, folder.offset + folder.limit,
                          sortBy, descending, pane);
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

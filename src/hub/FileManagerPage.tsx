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
  const locked = useRef(false);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const fileScrollRef = useRef<HTMLDivElement>(null);

  async function changeSplitTree(enabled: boolean) {
    if (savingSplit) return;
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

  async function load(path: string | null, showHidden: boolean,
    offset = 0, order: SortBy = sortBy, reverse = descending) {
    if (locked.current) return;
    const id = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      const response = await withTimeout(
        fileList(path, showHidden, offset, order, reverse), 8000
      );
      if (id !== request.current) return;
      if (!response || !Array.isArray(response.items) || typeof response.path !== "string") {
        throw new Error("Nieprawidłowa odpowiedź systemu plików.");
      }
      // Directory navigation and sorting begin at the top; switching Hub
      // tabs instead restores the saved scroll position for each pane.
      writeHubSession("files.treeScrollTop", 0);
      writeHubSession("files.listScrollTop", 0);
      if (treeScrollRef.current) treeScrollRef.current.scrollTop = 0;
      if (fileScrollRef.current) fileScrollRef.current.scrollTop = 0;
      setPage(response);
      setPathDraft(response.path);
      setEditingPath(false);
      setSelected(null);
      setAction(null);
      setName("");
      setMessage(response.truncated ? "Wyświetlanych jest maksymalnie 1500 elementów." : "");
    } catch (error) {
      if (id !== request.current) return;
      // Keep edited path in the input, so a typo can be corrected.
      setMessage("Nie można otworzyć folderu: " + String(error));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  useEffect(() => {
    // A restored page already contains its exact path, view mode, selection,
    // pending edit and clipboard. Do not overwrite it with HOME on tab entry.
    if (!page) void load(null, hidden, 0, sortBy, descending);
    return () => { request.current++; };
  }, []);

  useEffect(() => {
    if (!page) return;
    if (treeScrollRef.current) {
      treeScrollRef.current.scrollTop = readHubSession("files.treeScrollTop", 0);
    }
    if (fileScrollRef.current) {
      fileScrollRef.current.scrollTop = readHubSession("files.listScrollTop", 0);
    }
  }, [page?.path, page?.offset, splitTree]);

  async function operate(operation: "mkdir" | "rename" | "paste") {
    if (!page || locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (operation === "mkdir") {
        await withTimeout(makeFolder(page.path, name), 30000);
      } else if (operation === "rename" && selected) {
        await withTimeout(renameFile(selected.path, name), 30000);
      } else if (operation === "paste" && clipboard) {
        await withTimeout(pasteFile(clipboard.path, page.path, clipboard.mode), 30000);
        setClipboard(null);
      } else {
        return;
      }
      setAction(null);
      setName("");
      setSelected(null);
      const next = await withTimeout(
        fileList(page.path, hidden, 0, sortBy, descending), 8000
      );
      setPage(next);
      setPathDraft(next.path);
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
    void load(page?.path ?? null, hidden, 0, option.by, option.descending);
  }

  function changeHidden(show: boolean) {
    if (show === hidden) return;
    setHidden(show);
    void load(page?.path ?? null, show);
  }

  // Native Steam menu, like the existing menu on a folder/file row.
  // MenuGroup opens its choices in a right-hand submenu, as in Gaming Mode.
  function openBrowserMenu(parent: EventTarget) {
    if (busy) return;
    const shortcuts = page?.roots.filter(root => !breadcrumbs(page.path, page.roots)
      .some(part => part.path === root.path)) ?? [];
    showContextMenu(
      <Menu label="Opcje plików" cancelText="Wstecz">
        <MenuItem disabled={!page} onSelected={() => {
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

  function openFileMenu(entry: Entry, parent: EventTarget) {
    if (busy || entry.symlink) return;
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
        onCancelActionDescription={page?.parent ? "W górę" : "Wstecz"}
        onCancelButton={page?.parent ? event => {
          event.preventDefault();
          event.stopPropagation();
          void load(page.parent, hidden);
        } : undefined}
        onKeyDown={event => {
          if (event.key === "F5") {
            event.preventDefault();
            void load(page?.path ?? null, hidden, page?.offset ?? 0);
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
                      setPathDraft(page?.path ?? "");
                      setEditingPath(false);
                    }
                  }} />
              </div>
              <DialogButton disabled={busy} onClick={() => { void load(pathDraft, hidden); }}
                style={{ width: "auto", minWidth: 0, padding: "6px 10px" }}>Przejdź</DialogButton>
              <DialogButton disabled={busy} onClick={() => {
                setPathDraft(page?.path ?? "");
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
              {page?.path ?? (pathDraft || "/home/deck")}
            </DialogButton>
          )}
        </div>

        {/* Each breadcrumb is a focusable controller target, within allowed roots. */}
        {!!page && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, minWidth: 0 }}>
          {breadcrumbs(page.path, page.roots).map((part, i) =>
            <div key={part.path} style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 0 }}>
              {i > 0 && <span style={{ opacity: 0.55 }}>›</span>}
              <DialogButton disabled={busy || page.path === part.path}
                style={{ minWidth: 0, padding: "3px 9px", fontSize: 12, maxWidth: 190,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onClick={() => void load(part.path, hidden)}>
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
          <DialogButton disabled={busy || !page} onClick={() => { void operate("paste"); }}>
            Wklej
          </DialogButton>
          <DialogButton disabled={busy} onClick={() => { setClipboard(null); setMessage(""); }}>
            Anuluj
          </DialogButton>
        </div>}

        {/* The options toolbar stays above this fixed-height browser area.
            D-pad up/down traverses a pane; left/right changes panes. */}
        {page && <Focusable flow-children={splitTree ? "row" : "column"}
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
          style={{ display: "flex", flexDirection: splitTree ? "row" : "column",
            alignItems: "stretch", gap: splitTree ? 8 : 0,
            width: "100%", minWidth: 0, height: "min(54vh, 540px)",
            minHeight: 160, overflow: "hidden" }}>
          {splitTree && <Focusable flow-children="column"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
            style={{ width: "34%", minWidth: 125, flex: "0 0 34%",
              height: "100%", overflow: "hidden",
              paddingRight: 7, borderRight: "1px solid #444" }}>
            <div ref={treeScrollRef}
              onScroll={event => writeHubSession("files.treeScrollTop", event.currentTarget.scrollTop)}
              style={{ height: "100%", overflowY: "auto", overscrollBehavior: "contain",
                display: "flex", flexDirection: "column", gap: 3, paddingBottom: 48 }}>
              <ParentDirectoryRow parent={page.parent} disabled={busy}
                onOpen={parent => { void load(parent, hidden); }} />
            {page.items.filter(entry => entry.directory).map(entry =>
              selected?.path === entry.path && action === "rename"
                ? <Focusable key={entry.path} flow-children="row"
                    navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
                    style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      <TextField value={name} aria-label="Nowa nazwa katalogu"
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
                      style={{ minWidth: 0, width: "auto", padding: "5px" }}
                      onClick={() => void operate("rename")}>✓</DialogButton>
                  </Focusable>
                : <DialogButton key={entry.path} disabled={busy || entry.symlink}
                    onOKActionDescription="Otwórz"
                    onOptionsActionDescription="Opcje"
                    onOptionsButton={event => openFileMenu(entry, event.currentTarget ?? window)}
                    style={{ width: "100%", minWidth: 0, textAlign: "left", padding: "6px 7px",
                      background: selected?.path === entry.path ? "#426b99" : undefined }}
                    onClick={() => void load(entry.path, hidden)}>
                    <span style={{ display: "flex", minWidth: 0, gap: 5, alignItems: "center" }}>
                      <span aria-hidden="true">📁</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap" }}>{entry.name}</span>
                    </span>
                  </DialogButton>)}
            </div>
          </Focusable>}
          <Focusable flow-children="column"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
            style={{ display: "flex", flex: "1 1 0", minWidth: 0,
              height: "100%", overflow: "hidden" }}>
            <div ref={fileScrollRef}
              onScroll={event => writeHubSession("files.listScrollTop", event.currentTarget.scrollTop)}
              style={{ height: "100%", overflowY: "auto", overscrollBehavior: "contain",
                display: "flex", flexDirection: "column", gap: 3, paddingBottom: 48 }}>
              <ParentDirectoryRow parent={page.parent} disabled={busy}
                onOpen={parent => { void load(parent, hidden); }} />
            {(splitTree ? page.items.filter(entry => !entry.directory) : page.items)
              .map(entry =>
              <div key={entry.path} style={{ width: "100%", minWidth: 0 }}>
                {selected?.path === entry.path && action === "rename" ? (
                  <Focusable flow-children="row"
                    navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
                    style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
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
                    <div style={{ flex: "0 0 auto" }}>
                      <DialogButton disabled={busy || !name.trim()}
                        style={{ minWidth: 0, width: "auto", padding: "5px 9px" }}
                        aria-label="Zapisz nazwę" onClick={() => void operate("rename")}>✓</DialogButton>
                    </div>
                    <div style={{ flex: "0 0 auto" }}>
                      <DialogButton disabled={busy}
                        style={{ minWidth: 0, width: "auto", padding: "5px 9px" }}
                        aria-label="Anuluj zmianę nazwy"
                        onClick={() => setAction(null)}>×</DialogButton>
                    </div>
                  </Focusable>
                ) : (
                  <DialogButton disabled={busy || entry.symlink}
                    onOKActionDescription={entry.directory ? "Otwórz" : "Zaznacz"}
                    onOptionsActionDescription="Opcje"
                    onOptionsButton={event => openFileMenu(entry, event.currentTarget ?? window)}
                    style={{ width: "100%", minWidth: 0, textAlign: "left",
                      padding: "7px 9px",
                      background: selected?.path === entry.path ? "#426b99" : undefined }}
                    onClick={() => {
                      if (entry.directory) void load(entry.path, hidden);
                      else {
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
            {(splitTree ? page.items.every(entry => entry.directory) : page.items.length === 0) && !busy &&
              <div style={{ opacity: 0.7, padding: 6 }}>Pusty folder</div>}
            </div>
          </Focusable>
        </Focusable>}

        {page && page.total > page.limit &&
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <DialogButton disabled={busy || page.offset === 0}
              onClick={() => void load(page.path, hidden, Math.max(0, page.offset - page.limit))}>
              Poprzednia
            </DialogButton>
            <span style={{ opacity: 0.75, fontSize: 12 }}>
              {Math.floor(page.offset / page.limit) + 1} / {Math.ceil(page.total / page.limit)}
            </span>
            <DialogButton disabled={busy || page.offset + page.limit >= page.total}
              onClick={() => void load(page.path, hidden, page.offset + page.limit)}>
              Następna
            </DialogButton>
          </div>}
        {!!message && <div role="status" style={{ fontSize: 12, opacity: 0.8, padding: "2px 3px" }}>
          {message}
        </div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogButton, DialogControlsSection, Focusable, Menu, MenuItem, NavEntryPositionPreferences, showContextMenu, TextField, Toggle } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { breadcrumbs } from "../core/filePath";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
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

export function FileManagerPage() {
  // Remember the whole browser state across SidebarNavigation tab unmounts.
  // Clipboard and selection are RAM-only, never serialized to disk.
  const [page, setPage] = useHubSessionState<DirectoryPage | null>("files.page", null);
  const [pathDraft, setPathDraft] = useHubSessionState("files.pathDraft", "");
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
  const request = useRef(0);
  const locked = useRef(false);

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
      setPage(response);
      setPathDraft(response.path);
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

  // The same native SteamOS popup is used for sort and file actions.
  // It overlays the browser rather than adding scrollable rows or a new page.
  function openSortMenu(parent: EventTarget) {
    if (busy) return;
    showContextMenu(
      <Menu label="Sortuj" cancelText="Wstecz">
        {sortOptions.map(option =>
          <MenuItem key={option.data} selected={sortMode === option.data}
            onSelected={() => changeSort(option)}>
            {option.label}
          </MenuItem>)}
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
        {/* Address is optionally editable by Steam keyboard; folders open with A. */}
        <TextField value={pathDraft} placeholder="/home/deck/…"
          aria-label="Ścieżka katalogu"
          onChange={event => setPathDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              void load(pathDraft, hidden);
            }
          }} />

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

        {/* Same compact toolbar as SteamOS settings. Native controller dropdown. */}
        <Focusable flow-children="right"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
            gap: 5, width: "100%", minWidth: 0 }}>
          {page?.roots.filter(root => !breadcrumbs(page.path, page.roots)
            .some(part => part.path === root.path)).map(root =>
            <div key={root.path} style={{ flex: "0 0 auto", width: "auto" }}>
              <DialogButton disabled={busy}
                style={{ width: "auto", minWidth: 0, padding: "5px 8px" }}
                onClick={() => void load(root.path, hidden)}>{root.name}</DialogButton>
            </div>)}
          <div style={{ flex: "0 0 auto", width: "auto" }}>
            <DialogButton disabled={busy || !page}
              style={{ width: "auto", minWidth: 0, padding: "5px 8px" }}
              onClick={() => { setAction("folder"); setName(""); setSelected(null); setMessage(""); }}>
              + Folder
            </DialogButton>
          </div>
          <label style={{ display: "inline-flex", flex: "0 0 auto",
            gap: 4, alignItems: "center", fontSize: 12 }}>
            Ukryte
            <Toggle value={hidden} disabled={busy} onChange={value => {
              setHidden(value);
              void load(page?.path ?? null, value);
            }} />
          </label>
          <div style={{ flex: "0 0 auto", width: "auto", maxWidth: 205 }}>
            <DialogButton disabled={busy}
              onOKActionDescription="Sortuj"
              style={{ minWidth: 0, width: "auto", padding: "5px 9px" }}
              onClick={event => openSortMenu(event.currentTarget ?? window)}>
              Sortuj: {sortOptions.find(option => option.data === sortMode)?.label ?? "Nazwa A–Z"} ▾
            </DialogButton>
          </div>
        </Focusable>

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

        {/* Only this directory-browser area is split, never the toolbar or Hub. */}
        {page && <Focusable flow-children={splitTree ? "right" : undefined}
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
          style={{ display: "flex", flexDirection: splitTree ? "row" : "column",
            alignItems: "stretch", gap: splitTree ? 8 : 0,
            width: "100%", minWidth: 0 }}>
          {splitTree && <Focusable flow-children="down"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
            style={{ width: "34%", minWidth: 125, flex: "0 0 34%",
              paddingRight: 7, borderRight: "1px solid #444",
              maxHeight: "56vh", overflowY: "auto", display: "flex",
              flexDirection: "column", gap: 3 }}>
            <DialogButton disabled={busy || !page.parent}
              onOKActionDescription="W górę"
              style={{ width: "100%", minWidth: 0, textAlign: "left", padding: "6px 8px" }}
              onClick={() => { if (page.parent) void load(page.parent, hidden); }}>..</DialogButton>
            {page.items.filter(entry => entry.directory).map(entry =>
              selected?.path === entry.path && action === "rename"
                ? <Focusable key={entry.path} flow-children="right"
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
          </Focusable>}
          <Focusable flow-children="down"
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}
            style={{ display: "flex", flexDirection: "column", gap: 3,
              flex: "1 1 0", minWidth: 0,
              maxHeight: splitTree ? "56vh" : undefined,
              overflowY: splitTree ? "auto" : undefined }}>
            {(splitTree ? page.items.filter(entry => !entry.directory) : page.items)
              .map(entry =>
              <div key={entry.path} style={{ width: "100%", minWidth: 0 }}>
                {selected?.path === entry.path && action === "rename" ? (
                  <Focusable flow-children="right"
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
            {page.items.length === 0 && !busy &&
              <div style={{ opacity: 0.7, padding: 6 }}>Pusty folder</div>}
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

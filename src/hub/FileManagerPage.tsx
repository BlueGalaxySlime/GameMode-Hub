import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogButton, DialogControlsSection, Dropdown, Focusable, TextField, Toggle } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { breadcrumbs } from "../core/filePath";

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
  const [page, setPage] = useState<DirectoryPage | null>(null);
  const [pathDraft, setPathDraft] = useState("");
  const [hidden, setHidden] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [descending, setDescending] = useState(false);
  const [sortMode, setSortMode] = useState("name-asc");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [name, setName] = useState("");
  const [action, setAction] = useState<"folder" | "rename" | null>(null);
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
    void load(null, false);
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

  function clipboardAction(mode: "copy" | "move") {
    if (!selected || selected.symlink) return;
    if (selected.directory && mode === "copy") {
      setMessage("Kopiowanie całych folderów będzie dostępne później.");
      return;
    }
    setClipboard({ path: selected.path, name: selected.name, mode });
    setMessage("Wybierz folder docelowy i użyj Wklej.");
  }

  function changeSort(option: typeof sortOptions[number]) {
    setSortMode(option.data);
    setSortBy(option.by);
    setDescending(option.descending);
    void load(page?.path ?? null, hidden, 0, option.by, option.descending);
  }

  // SteamOS owns the black footer. Expose controller hints through the
  // focus/navigation API, not duplicate text buttons or a custom footer.
  return <DialogBody>
    <DialogControlsSection>
      <Focusable
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0 }}
        onOptionsActionDescription="Odśwież"
        onOptionsButton={() => { void load(page?.path ?? null, hidden, page?.offset ?? 0); }}
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
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
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
          <div style={{ flex: "0 0 154px", width: 154, minWidth: 0 }}>
            <Dropdown menuLabel="Sortuj" disabled={busy}
              rgOptions={sortOptions.map(option => ({ data: option.data, label: option.label }))}
              selectedOption={sortMode}
              onChange={value => {
                const option = sortOptions.find(item => item.data === value.data);
                if (option) changeSort(option);
              }} />
          </div>
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

        {/* A opens folder / selects file, X toggles inline operations.
            No submenu, no "Zamknij" and no extra screen height. */}
        {page && <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", minWidth: 0 }}>
          {page.items.map(entry => <div key={entry.path} style={{ width: "100%", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", minWidth: 0 }}>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <DialogButton disabled={busy || entry.symlink}
                  onOKActionDescription={entry.directory ? "Otwórz" : "Opcje"}
                  onSecondaryActionDescription="Opcje"
                  onSecondaryButton={() => {
                    setSelected(current => current?.path === entry.path ? null : entry);
                    setAction(null); setName(entry.name); setMessage("");
                  }}
                  onOptionsActionDescription="Odśwież"
                  onOptionsButton={() => { void load(page.path, hidden, page.offset); }}
                  style={{ textAlign: "left", width: "100%", minWidth: 0, padding: "6px 8px",
                    background: selected?.path === entry.path ? "#426b99" : undefined }}
                  onClick={() => {
                    if (entry.directory) void load(entry.path, hidden);
                    else {
                      setSelected(current => current?.path === entry.path ? null : entry);
                      setAction(null); setName(entry.name); setMessage("");
                    }
                  }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", minWidth: 0 }}>
                    <span aria-hidden="true">{entry.directory ? "📁" : entry.symlink ? "🔗" : "📄"}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "left",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                    {!entry.directory && !entry.symlink && selected?.path !== entry.path &&
                      <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>
                        {readableSize(entry.size)}
                      </span>}
                  </span>
                </DialogButton>
              </div>
              {selected?.path === entry.path && !entry.symlink && action !== "rename" &&
                <div style={{ display: "flex", gap: 3, flex: "0 0 auto", alignItems: "center" }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <DialogButton disabled={busy}
                      style={{ minWidth: 0, width: "auto", padding: "5px 7px" }}
                      onClick={() => { setAction("rename"); setName(entry.name); }}>Zmień</DialogButton>
                  </div>
                  {!entry.directory && <div style={{ flex: "0 0 auto" }}>
                    <DialogButton disabled={busy}
                      style={{ minWidth: 0, width: "auto", padding: "5px 7px" }}
                      onClick={() => clipboardAction("copy")}>Kopiuj</DialogButton>
                  </div>}
                  <div style={{ flex: "0 0 auto" }}>
                    <DialogButton disabled={busy}
                      style={{ minWidth: 0, width: "auto", padding: "5px 7px" }}
                      onClick={() => clipboardAction("move")}>Przenieś</DialogButton>
                  </div>
                </div>}
              {selected?.path === entry.path && action === "rename" &&
                <div style={{ display: "flex", flex: "2 1 0", gap: 3, alignItems: "center", minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TextField value={name} aria-label="Nowa nazwa"
                      onChange={event => setName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter" && name.trim()) {
                          event.preventDefault(); void operate("rename");
                        }
                        if (event.key === "Escape") setAction(null);
                      }} />
                  </div>
                  <div style={{ flex: "0 0 auto" }}>
                    <DialogButton disabled={busy || !name.trim()}
                      style={{ minWidth: 0, width: "auto", padding: "5px 7px" }}
                      onClick={() => void operate("rename")}>✓</DialogButton>
                  </div>
                </div>}
            </div>
          </div>)}
          {page.items.length === 0 && !busy &&
            <div style={{ opacity: 0.7, padding: 6 }}>Pusty folder</div>}
        </div>}

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

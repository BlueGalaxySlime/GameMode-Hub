import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { DialogBody, DialogButton, DialogControlsSection, TextField, Toggle } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { breadcrumbs } from "../core/filePath";

type SortBy = "name" | "size" | "date";
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

const sortLabels: Record<SortBy, string> = { name: "Nazwa", size: "Rozmiar", date: "Data" };
const sortOrder: SortBy[] = ["name", "size", "date"];

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

  function changeSort(next: SortBy, reverse: boolean) {
    setSortBy(next);
    setDescending(reverse);
    void load(page?.path ?? null, hidden, 0, next, reverse);
  }

  return <DialogBody>
    <DialogControlsSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0 }}>
        {/* Single editable address bar: keyboard Enter and controller button. */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 6, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField value={pathDraft} placeholder="/home/deck/…"
              aria-label="Ścieżka folderu"
              onChange={event => setPathDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void load(pathDraft, hidden);
                }
              }} />
          </div>
          <DialogButton disabled={busy || !pathDraft.trim()}
            style={{ minWidth: 0, padding: "6px 10px" }}
            onClick={() => void load(pathDraft, hidden)}>Przejdź</DialogButton>
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

        {/* A single compact toolbar: root navigation is handled by breadcrumbs. */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {page?.roots.filter(root => !breadcrumbs(page.path, page.roots)
            .some(part => part.path === root.path)).map(root =>
            <DialogButton key={root.path} disabled={busy}
              style={{ minWidth: 0, padding: "6px 9px" }}
              onClick={() => void load(root.path, hidden)}>{root.name}</DialogButton>)}
          <DialogButton disabled={busy || !page?.parent}
            style={{ minWidth: 0, padding: "6px 9px" }}
            onClick={() => { if (page?.parent) void load(page.parent, hidden); }}>
            ↑
          </DialogButton>
          <DialogButton disabled={busy} style={{ minWidth: 0, padding: "6px 9px" }}
            onClick={() => void load(page?.path ?? null, hidden, page?.offset ?? 0)}>
            Odśwież
          </DialogButton>
          <DialogButton disabled={busy || !page} style={{ minWidth: 0, padding: "6px 9px" }}
            onClick={() => { setAction("folder"); setName(""); setSelected(null); setMessage(""); }}>
            + Folder
          </DialogButton>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center",
            padding: "0 3px", fontSize: 12 }}>
            Ukryte
            <Toggle value={hidden} disabled={busy} onChange={value => {
              setHidden(value);
              void load(page?.path ?? null, value);
            }} />
          </label>
          <DialogButton disabled={busy} style={{ minWidth: 0, padding: "6px 9px" }}
            onClick={() => {
              const next = sortOrder[(sortOrder.indexOf(sortBy) + 1) % sortOrder.length];
              changeSort(next, descending);
            }}>Sortuj: {sortLabels[sortBy]}</DialogButton>
          <DialogButton disabled={busy} aria-label="Zmień kierunek sortowania"
            style={{ minWidth: 0, padding: "6px 9px" }}
            onClick={() => changeSort(sortBy, !descending)}>
            {descending ? "↓" : "↑"}
          </DialogButton>
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

        {/* Each filename is one full-width primary button; operations are inline. */}
        {page && <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", minWidth: 0 }}>
          {page.items.map(entry => <div key={entry.path} style={{ width: "100%", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "stretch", gap: 5, width: "100%", minWidth: 0 }}>
              <DialogButton disabled={busy || entry.symlink}
                style={{ textAlign: "left", flex: 1, minWidth: 0, padding: "8px 11px",
                  background: selected?.path === entry.path ? "#426b99" : undefined }}
                onClick={() => {
                  if (entry.directory) {
                    void load(entry.path, hidden);
                  } else {
                    setSelected(entry);
                    setAction(null);
                    setName(entry.name);
                    setMessage("");
                  }
                }}>
                <span style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", minWidth: 0 }}>
                  <span aria-hidden="true">{entry.directory ? "📁" : entry.symlink ? "🔗" : "📄"}</span>
                  <span style={{ textAlign: "left", flex: 1, minWidth: 0, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                  {!entry.directory && !entry.symlink &&
                    <span style={{ fontSize: 12, opacity: 0.65, flexShrink: 0 }}>
                      {readableSize(entry.size)}
                    </span>}
                </span>
              </DialogButton>
              {entry.directory && <DialogButton disabled={busy} aria-label={"Opcje: " + entry.name}
                style={{ minWidth: 40, width: 40, padding: "5px 0" }}
                onClick={() => {
                  setSelected(entry);
                  setAction(null);
                  setName(entry.name);
                  setMessage("");
                }}>⋯</DialogButton>}
            </div>
            {selected?.path === entry.path && !entry.symlink &&
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 3px 8px 12px" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <DialogButton disabled={busy} onClick={() => {
                    setAction("rename"); setName(entry.name);
                  }}>Zmień nazwę</DialogButton>
                  {!entry.directory && <DialogButton disabled={busy}
                    onClick={() => clipboardAction("copy")}>Kopiuj</DialogButton>}
                  <DialogButton disabled={busy}
                    onClick={() => clipboardAction("move")}>Przenieś</DialogButton>
                  <DialogButton disabled={busy} onClick={() => {
                    setSelected(null); setAction(null);
                  }}>Zamknij</DialogButton>
                </div>
                {action === "rename" && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <TextField value={name} placeholder="Nowa nazwa"
                    onChange={event => setName(event.target.value)} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <DialogButton disabled={busy || !name.trim()}
                      onClick={() => { void operate("rename"); }}>Zapisz</DialogButton>
                    <DialogButton disabled={busy} onClick={() => setAction(null)}>Anuluj</DialogButton>
                  </div>
                </div>}
              </div>}
          </div>)}
          {page.items.length === 0 && !busy && <div style={{ opacity: 0.7, fontSize: 14, padding: 7 }}>
            Pusty folder
          </div>}
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
      </div>
    </DialogControlsSection>
  </DialogBody>;
}

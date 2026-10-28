import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader,
  Field, TextField, Toggle
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";

type Entry = {
  name: string; path: string; directory: boolean; symlink: boolean; size: number | null;
};
type DirectoryPage = {
  path: string; parent: string | null;
  roots: { name: string; path: string }[];
  items: Entry[]; total: number; offset: number; limit: number; truncated: boolean;
};
type Clipboard = { path: string; name: string; mode: "copy" | "move" };
const fileList = callable<[string | null, boolean, number], DirectoryPage>("files_list");
const makeFolder = callable<[string, string], { path: string }>("files_mkdir");
const renameFile = callable<[string, string], { path: string }>("files_rename");
const pasteFile = callable<[string, string, "copy" | "move"], { path: string }>("files_paste");

function readableSize(size: number | null) {
  if (size === null) return "Folder";
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + " MB";
  return (size / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

export function FileManagerPage() {
  const [page, setPage] = useState<DirectoryPage | null>(null);
  const [hidden, setHidden] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [name, setName] = useState("");
  const [action, setAction] = useState<"folder" | "rename" | null>(null);
  const [message, setMessage] = useState("Wybierz folder albo plik.");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const locked = useRef(false);

  async function load(path: string | null, showHidden: boolean, offset = 0) {
    if (locked.current) return;
    const id = ++request.current;
    setBusy(true);
    setMessage("Wczytywanie katalogu…");
    try {
      const response = await withTimeout(fileList(path, showHidden, offset), 8000);
      if (id !== request.current) return;
      if (!response || !Array.isArray(response.items)) throw new Error("Nieprawidłowa odpowiedź systemu plików.");
      setPage(response);
      setSelected(null);
      setAction(null);
      setName("");
      setMessage(response.truncated
        ? "Duży folder: wyświetlanych jest maksymalnie 1500 wpisów."
        : "Wybierz plik, aby zobaczyć dostępne operacje.");
    } catch (error) {
      if (id !== request.current) return;
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
      const next = await withTimeout(fileList(page.path, hidden, 0), 8000);
      setPage(next);
      setMessage("Operacja zakończona.");
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
    setMessage("Przejdź do folderu docelowego i wybierz Wklej tutaj.");
  }

  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Pliki</DialogControlsSectionHeader>
      <Field label="Bieżący katalog" description={page?.path ?? "Wczytywanie…"} />
      <Field label="Lokalizacje">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {page?.roots.map(root =>
            <DialogButton key={root.path} disabled={busy} onClick={() => void load(root.path, hidden)}>
              {root.name}
            </DialogButton>)}
        </div>
      </Field>
      <Field label="Nawigacja" description="Wybierz folder, aby do niego wejść. Powrót prowadzi o poziom wyżej.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <DialogButton disabled={busy || !page?.parent} onClick={() => void load(page?.parent ?? null, hidden)}>
            W górę
          </DialogButton>
          <DialogButton disabled={busy} onClick={() => void load(page?.path ?? null, hidden, page?.offset ?? 0)}>
            Odśwież
          </DialogButton>
        </div>
      </Field>
      <Field label="Pokaż ukryte pliki">
        <Toggle value={hidden} disabled={busy} onChange={value => {
          setHidden(value);
          void load(page?.path ?? null, value);
        }} />
      </Field>
      {page && <Field label={"Zawartość (" + page.total + ")"}
        description="Pliki są przeglądane lokalnie. Dowiązania symboliczne pozostają nieaktywne.">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {page.items.map(entry => <div key={entry.path}
            style={{ display: "flex", gap: 6, width: "100%", alignItems: "center" }}>
            <DialogButton disabled={busy || entry.symlink}
              style={{ textAlign: "left", flex: 1, background: selected?.path === entry.path ? "#426b99" : undefined }}
              onClick={() => {
                if (entry.directory) {
                  void load(entry.path, hidden);
                } else {
                  setSelected(entry);
                  setAction(null);
                  setName(entry.name);
                }
              }}>
              {entry.directory ? "📁 " : entry.symlink ? "🔗 " : "📄 "}
              {entry.name + (entry.directory ? "/" : " · " + readableSize(entry.size))}
            </DialogButton>
            {entry.directory && <DialogButton disabled={busy}
              onClick={() => { setSelected(entry); setAction(null); setName(entry.name); }}>
              Wybierz
            </DialogButton>}
          </div>)}
        </div>
      </Field>}
      {page && page.total > page.limit && <Field label="Strony">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <DialogButton disabled={busy || page.offset === 0}
            onClick={() => void load(page.path, hidden, Math.max(0, page.offset - page.limit))}>Poprzednia</DialogButton>
          <DialogButton disabled={busy || page.offset + page.limit >= page.total}
            onClick={() => void load(page.path, hidden, page.offset + page.limit)}>Następna</DialogButton>
        </div>
      </Field>}
      {page && <Field label="Nowy folder">
        <DialogButton disabled={busy} onClick={() => { setAction("folder"); setName(""); setSelected(null); }}>
          Utwórz folder
        </DialogButton>
      </Field>}
      {selected && <Field label={(selected.directory ? "Wybrany folder: " : "Wybrany plik: ") + selected.name} description={readableSize(selected.size)}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <DialogButton disabled={busy} onClick={() => {
            setAction("rename"); setName(selected.name);
          }}>Zmień nazwę</DialogButton>
          <DialogButton disabled={busy || selected.directory} onClick={() => clipboardAction("copy")}>Kopiuj</DialogButton>
          <DialogButton disabled={busy} onClick={() => clipboardAction("move")}>Przenieś</DialogButton>
        </div>
      </Field>}
      {action && <Field label={action === "folder" ? "Nazwa nowego folderu" : "Nowa nazwa"}
        description="Wpisz nazwę za pomocą klawiatury ekranowej SteamOS.">
        <TextField value={name} onChange={event => setName(event.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          <DialogButton disabled={busy || !name.trim()} onClick={() => void operate(action === "folder" ? "mkdir" : "rename")}>
            Zatwierdź
          </DialogButton>
          <DialogButton disabled={busy} onClick={() => setAction(null)}>Anuluj</DialogButton>
        </div>
      </Field>}
      {clipboard && <Field label={clipboard.mode === "copy" ? "Kopiowanie" : "Przenoszenie"}
        description={clipboard.name + " → " + (page?.path ?? "…")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <DialogButton disabled={busy} onClick={() => void operate("paste")}>Wklej tutaj</DialogButton>
          <DialogButton disabled={busy} onClick={() => setClipboard(null)}>Anuluj</DialogButton>
        </div>
      </Field>}
      <Field label="Stan" description={message} />
      <Field label="Bezpieczeństwo" description="Operacje wyłącznie w katalogu domowym i na nośnikach użytkownika. Usuwanie plików i otwieranie programów nie jest jeszcze dostępne." />
    </DialogControlsSection>
  </DialogBody>;
}

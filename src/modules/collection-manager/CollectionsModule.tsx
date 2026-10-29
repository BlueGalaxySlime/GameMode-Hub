import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field,
  Focusable, ModalRoot, NavEntryPositionPreferences, Toggle, showModal } from "@decky/ui";
import { HubTextInput } from "../../hub/HubTextInput";
import { hubCollectionsChanged, hubCollectionsEnabledChanged } from "../tab-manager/LibraryIntegration";

export type CollectionFilter = "manual" | "all" | "installed" | "favorites" | "non_steam";
export type HubCollection = {
  id: string;
  title: string;
  filter: CollectionFilter;
  app_ids: string[];
};

const FILTERS: CollectionFilter[] = ["manual", "all", "installed", "favorites", "non_steam"];
const FILTER_NAMES: Record<CollectionFilter, string> = {
  manual: "Ręczna lista gier",
  all: "Wszystkie gry",
  installed: "Zainstalowane",
  favorites: "Ulubione",
  non_steam: "Spoza Steam"
};
const read = callable<[], HubCollection[]>("get_hub_collections");
const save = callable<[HubCollection[]], HubCollection[]>("save_hub_collections");
const readEnabled = callable<[], boolean>("get_hub_collections_enabled");
const saveEnabled = callable<[boolean], boolean>("set_hub_collections_enabled");

function CollectionsManagerDialog({ closeModal }: { closeModal?: () => void }) {
  const [collections, setCollections] = useState<HubCollection[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [gameId, setGameId] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    read().then(value => {
      if (!mounted) return;
      setCollections(value);
      hubCollectionsChanged(value);
    }).catch(() => {
      if (mounted) setError("Nie udało się odczytać kolekcji.");
    }).finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);

  async function persist(next: HubCollection[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const stored = await save(next);
      setCollections(stored);
      hubCollectionsChanged(stored);
      setConfirmDelete(null);
    } catch {
      setError("Nie udało się zapisać kolekcji. Dotychczasowy układ zachowano.");
    } finally { setBusy(false); }
  }

  function create() {
    const title = name.trim();
    if (!title || busy) return;
    const id = "collection-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    void persist([...collections, { id, title, filter: "manual", app_ids: [] }]);
    setName("");
  }

  function rename(id: string) {
    if (!editName.trim()) return;
    void persist(collections.map(c => c.id === id ? { ...c, title: editName.trim() } : c));
    setEditing(null);
  }

  function nextFilter(collection: HubCollection) {
    const index = FILTERS.indexOf(collection.filter);
    const filter = FILTERS[(index + 1) % FILTERS.length];
    void persist(collections.map(c => c.id === collection.id ? { ...c, filter } : c));
  }

  function addGame(id: string) {
    const text = gameId.trim();
    if (!/^[0-9]{1,10}$/.test(text) || Number(text) < 1 || Number(text) > 4294967295) {
      setError("Wpisz prawidłowe numeryczne AppID gry.");
      return;
    }
    const app_id = String(Number(text));
    void persist(collections.map(c => c.id === id
      ? { ...c, app_ids: [...new Set([...c.app_ids, app_id])] }
      : c));
    setGameId("");
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= collections.length) return;
    const next = [...collections];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ width: "min(88vw, 620px)", maxWidth: "100%", padding: 12,
      display: "flex", flexDirection: "column", gap: 8 }}>
      <Focusable flow-children="column" style={{ maxHeight: "min(68vh, 560px)",
        overflowY: "auto" }}>
        <DialogControlsSection>
          <DialogControlsSectionHeader>Zarządzaj kolekcjami</DialogControlsSectionHeader>
    <Field label="Nowa kolekcja">
      <HubTextInput value={name} disabled={busy} placeholder="Nazwa kolekcji"
        onChange={event => setName(event.target.value)} onEditValue={setName} />
    </Field>
    <DialogButton disabled={busy || !name.trim() || collections.length >= 64}
      onClick={create}>Dodaj kolekcję</DialogButton>
    {collections.map((collection, index) => <div key={collection.id}
      style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.13)" }}>
      {editing === collection.id ? <>
        <Field label="Zmień nazwę">
          <HubTextInput value={editName} disabled={busy}
            onChange={event => setEditName(event.target.value)} onEditValue={setEditName} />
        </Field>
        <DialogButton disabled={busy || !editName.trim()} onClick={() => rename(collection.id)}>Zapisz nazwę</DialogButton>
        <DialogButton disabled={busy} onClick={() => setEditing(null)}>Anuluj</DialogButton>
      </> : <Field label={collection.title}
        description={FILTER_NAMES[collection.filter] + " · " + collection.app_ids.length + " przypisanych AppID"} />}
      <DialogButton disabled={busy} onClick={() => {
        setEditing(collection.id); setEditName(collection.title);
      }}>Zmień nazwę</DialogButton>
      <DialogButton disabled={busy} onClick={() => nextFilter(collection)}>
        Reguła: {FILTER_NAMES[collection.filter]}
      </DialogButton>
      <DialogButton disabled={busy || index === 0} onClick={() => move(index, -1)}>Wyżej</DialogButton>
      <DialogButton disabled={busy || index === collections.length - 1}
        onClick={() => move(index, 1)}>Niżej</DialogButton>
      <DialogButton disabled={busy} onClick={() => {
        setAddingTo(addingTo === collection.id ? null : collection.id);
        setGameId("");
      }}>{addingTo === collection.id ? "Ukryj przypisania" : "Przypisane gry"}</DialogButton>
      {addingTo === collection.id && <>
        <Field label="Dodaj grę (AppID)">
          <HubTextInput value={gameId} disabled={busy} placeholder="AppID"
            onChange={event => setGameId(event.target.value)} onEditValue={setGameId} />
        </Field>
        <DialogButton disabled={busy || !gameId.trim()} onClick={() => addGame(collection.id)}>
          Dodaj AppID
        </DialogButton>
        {collection.app_ids.map(id => <Field key={id} label={"AppID " + id}>
          <DialogButton disabled={busy} onClick={() => void persist(collections.map(c =>
            c.id === collection.id ? { ...c, app_ids: c.app_ids.filter(a => a !== id) } : c
          ))}>Usuń z kolekcji</DialogButton>
        </Field>)}
      </>}
      {confirmDelete === collection.id ? <>
        <Field label="Usunąć tę kolekcję?"
          description="Karty odwołujące się do niej nie zostaną usunięte; do czasu wyboru innej kolekcji będą puste." />
        <DialogButton disabled={busy} onClick={() => void persist(collections.filter(c =>
          c.id !== collection.id
        ))}>Potwierdź usunięcie</DialogButton>
        <DialogButton disabled={busy} onClick={() => setConfirmDelete(null)}>Anuluj</DialogButton>
      </> : <DialogButton disabled={busy} onClick={() => setConfirmDelete(collection.id)}>Usuń kolekcję</DialogButton>}
    </div>)}
    {!busy && !collections.length && <Field label="Brak kolekcji"
      description="Dodaj kolekcję, aby przypisywać gry i reguły." />}
    {error && <Field label="Błąd" description={error} />}
        </DialogControlsSection>
      </Focusable>
      <DialogButton onClick={() => closeModal?.()}>Zamknij</DialogButton>
    </div>
  </ModalRoot>;
}

export function CollectionsModule() {
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    readEnabled().then(value => {
      if (alive) setEnabled(value);
    }).catch(() => {
      if (alive) setError("Nie udało się odczytać ustawienia kolekcji.");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  async function toggle(value: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const stored = await saveEnabled(value);
      setEnabled(stored);
      hubCollectionsEnabledChanged(stored);
    } catch {
      setError("Nie udało się zapisać ustawienia kolekcji.");
    } finally {
      setBusy(false);
    }
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Kolekcje</DialogControlsSectionHeader>
    <Focusable flow-children="row"
      navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, padding: "8px 0" }}>
      <DialogButton style={{ flex: "0 1 auto", minWidth: 150 }}
        onClick={() => showModal(<CollectionsManagerDialog />)}>
        Zarządzaj ▾
      </DialogButton>
      <Toggle value={enabled} disabled={busy}
        onChange={value => { void toggle(value); }} />
    </Focusable>
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

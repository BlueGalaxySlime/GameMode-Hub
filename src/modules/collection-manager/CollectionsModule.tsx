import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  ConfirmModal, DialogControlsSection, DialogControlsSectionHeader,
  Field, Menu, MenuGroup, MenuItem, TextField, showContextMenu, showModal
} from "@decky/ui";
import { OptimizationManageControl } from "../../hub/OptimizationManageControl";
import { hubCollectionsChanged, hubCollectionsEnabledChanged } from "../tab-manager/LibraryIntegration";

export type CollectionFilter = "manual" | "all" | "installed" | "favorites" | "non_steam";
export type HubCollection = {
  id: string;
  title: string;
  filter: CollectionFilter;
  app_ids: string[];
};

const FILTER_NAMES: Record<CollectionFilter, string> = {
  manual: "Wybrane gry",
  all: "Wszystkie gry",
  installed: "Zainstalowane",
  favorites: "Ulubione",
  non_steam: "Spoza Steam"
};
const FILTERS: CollectionFilter[] = ["manual", "all", "installed", "favorites", "non_steam"];

const read = callable<[], HubCollection[]>("get_hub_collections");
const save = callable<[HubCollection[]], HubCollection[]>("save_hub_collections");
const readEnabled = callable<[], boolean>("get_hub_collections_enabled");
const saveEnabled = callable<[boolean], boolean>("set_hub_collections_enabled");

/** Uses the same native Steam name dialog as the Cards menu. */
function CollectionValueModal({ title, initial = "", appId = false, onSave, closeModal }: {
  title: string;
  initial?: string;
  appId?: boolean;
  onSave: (value: string) => Promise<void>;
  closeModal?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    const trimmed = value.trim();
    if (appId
      ? !/^[0-9]{1,10}$/.test(trimmed) || Number(trimmed) < 1 || Number(trimmed) > 4294967295
      : !trimmed || trimmed.length > 80) {
      setError(appId ? "Wpisz poprawne AppID gry." : "Nazwa musi mieć 1–80 znaków.");
      return;
    }
    setBusy(true);
    try {
      await onSave(appId ? String(Number(trimmed)) : trimmed);
      closeModal?.();
    } catch {
      setError("Nie można zapisać zmiany. Zachowano poprzednie dane.");
    } finally {
      setBusy(false);
    }
  }

  return <ConfirmModal
    strTitle={title}
    strOKButtonText="Zapisz"
    onOK={() => { void submit(); }}
    onCancel={closeModal}
    onEscKeypress={closeModal}>
    <Field label={appId ? "AppID gry" : "Nazwa kolekcji"}>
      <TextField value={value} focusOnMount
        onChange={event => setValue(event.target.value)} />
    </Field>
    {!!error && <Field label="Błąd" description={error} />}
    {busy && <Field label="Zapisywanie…" />}
  </ConfirmModal>;
}

function CollectionDeleteModal({ collection, onDelete, closeModal }: {
  collection: HubCollection;
  onDelete: () => Promise<void>;
  closeModal?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <ConfirmModal strTitle={`Usunąć kolekcję „${collection.title}”?`}
    strOKButtonText="Usuń"
    onCancel={closeModal}
    onEscKeypress={closeModal}
    onOK={() => {
      if (busy) return;
      setBusy(true);
      void onDelete().then(() => closeModal?.()).catch(() =>
        setError("Nie udało się usunąć kolekcji.")
      ).finally(() => setBusy(false));
    }}>
    <Field label="Usunięta zostanie tylko kolekcja Huba"
      description="Nie usuwamy gier, kolekcji Steam ani kart Huba." />
    {!!error && <Field label="Błąd" description={error} />}
  </ConfirmModal>;
}

/**
 * Like LibraryCardsContextMenu: native SteamOS menu, grouped actions, and
 * short native dialogs only when text/confirmation is needed.
 * No full-screen editor, cycling filters, or extra row of action buttons.
 */
export function CollectionsContextMenu() {
  const [collections, setCollections] = useState<HubCollection[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    read().then(value => {
      if (!alive) return;
      setCollections(value);
      hubCollectionsChanged(value);
    }).catch(() => {
      if (alive) setError("Nie udało się odczytać kolekcji.");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  async function mutate(change: (items: HubCollection[]) => HubCollection[]) {
    if (busy) throw new Error("Zapis jest zajęty");
    setBusy(true);
    try {
      const current = await read();
      const updated = await save(change(current));
      setCollections(updated);
      hubCollectionsChanged(updated);
    } catch (cause) {
      setError("Nie można zapisać kolekcji.");
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  function create() {
    showModal(<CollectionValueModal title="Nowa kolekcja"
      onSave={title => mutate(items => {
        if (items.length >= 64) throw new Error("Limit kolekcji");
        const id = "collection-" + Date.now().toString(36) + "-" +
          Math.random().toString(36).slice(2, 8);
        return [...items, { id, title, filter: "manual", app_ids: [] }];
      })} />);
  }

  function rename(item: HubCollection) {
    showModal(<CollectionValueModal title="Zmień nazwę kolekcji"
      initial={item.title}
      onSave={title => mutate(items => items.map(entry =>
        entry.id === item.id ? { ...entry, title } : entry))} />);
  }

  function addApp(item: HubCollection) {
    showModal(<CollectionValueModal title="Dodaj grę do kolekcji" appId
      onSave={appId => mutate(items => items.map(entry =>
        entry.id === item.id
          ? { ...entry, app_ids: [...new Set([...entry.app_ids, appId])] }
          : entry))} />);
  }

  function move(item: HubCollection, offset: number) {
    void mutate(items => {
      const from = items.findIndex(entry => entry.id === item.id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= items.length) return items;
      const result = [...items];
      [result[from], result[to]] = [result[to], result[from]];
      return result;
    }).catch(() => {});
  }

  return <Menu label="Kolekcje">
    {!!error && <MenuItem disabled>{error}</MenuItem>}
    <MenuItem disabled={busy || collections.length >= 64} onClick={create}>
      Dodaj kolekcję
    </MenuItem>
    {collections.length > 0
      ? <MenuGroup label="Moje kolekcje">
        {collections.map((item, index) => <MenuGroup key={item.id} label={item.title}>
          <MenuItem disabled={busy} onClick={() => rename(item)}>Zmień nazwę</MenuItem>
          <MenuGroup label="Zawartość">
            {FILTERS.map(filter => <MenuItem key={filter} disabled={busy}
              onClick={() => { void mutate(items => items.map(entry =>
                entry.id === item.id ? { ...entry, filter } : entry)).catch(() => {}); }}>
              {FILTER_NAMES[filter]}{item.filter === filter ? " ✓" : ""}
            </MenuItem>)}
            {item.filter === "manual" && <MenuGroup label="Wybrane gry">
              <MenuItem disabled={busy || item.app_ids.length >= 1024}
                onClick={() => addApp(item)}>Dodaj AppID</MenuItem>
              {item.app_ids.map(appId => <MenuItem key={appId} disabled={busy}
                onClick={() => { void mutate(items => items.map(entry =>
                  entry.id === item.id
                    ? { ...entry, app_ids: entry.app_ids.filter(id => id !== appId) }
                    : entry)).catch(() => {}); }}>
                Usuń AppID {appId}
              </MenuItem>)}
            </MenuGroup>}
          </MenuGroup>
          <MenuItem disabled={busy || index === 0}
            onClick={() => move(item, -1)}>Przesuń wyżej</MenuItem>
          <MenuItem disabled={busy || index === collections.length - 1}
            onClick={() => move(item, 1)}>Przesuń niżej</MenuItem>
          <MenuItem disabled={busy} onClick={() =>
            showModal(<CollectionDeleteModal collection={item}
              onDelete={() => mutate(items => items.filter(entry => entry.id !== item.id))} />)}>
            Usuń kolekcję
          </MenuItem>
        </MenuGroup>)}
      </MenuGroup>
      : <MenuItem disabled>Brak własnych kolekcji</MenuItem>}
  </Menu>;
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

  function openManageMenu(parent: EventTarget | null) {
    if (busy || !parent) return;
    showContextMenu(<CollectionsContextMenu />, parent, {
      bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true
    });
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Kolekcje</DialogControlsSectionHeader>
    <OptimizationManageControl busy={busy} enabled={enabled}
      onManage={openManageMenu} onToggle={value => { void toggle(value); }} />
    {!!error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

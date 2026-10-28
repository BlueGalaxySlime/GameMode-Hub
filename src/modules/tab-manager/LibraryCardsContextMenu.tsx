import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import {
  ConfirmModal, Field, Menu, MenuGroup, MenuItem, TextField, showModal
} from "@decky/ui";
import {
  availableHubCollections, availableSteamCollections, availableSteamLibraryTabs,
  setSystemTabHidden, tabManagerTabsChanged
} from "./LibraryIntegration";
import type { TabDefinition, TabFilter } from "./LibraryIntegration";

const readTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const saveTabs = callable<[TabDefinition[]], TabDefinition[]>("save_tab_definitions");
const listProfiles = callable<[], string[]>("list_tab_profiles");
const saveProfile = callable<[string], string[]>("save_tab_profile");
const loadProfile = callable<[string], TabDefinition[]>("load_tab_profile");
const deleteProfile = callable<[string], string[]>("delete_tab_profile");

type CardAction = (value: string) => Promise<void>;

function newId(): string {
  return "card-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

/** Native Steam modal for the one detail a menu cannot edit: a card/profile name. */
function NameModal({ title, initial = "", onSave, closeModal }: {
  title: string;
  initial?: string;
  onSave: CardAction;
  closeModal?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const name = value.trim();
    if (!name || busy) return;
    setBusy(true); setError("");
    try {
      await onSave(name);
      closeModal?.();
    } catch {
      setError("Nie udało się zapisać. Zachowano poprzednie ustawienia.");
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
    <Field label="Nazwa">
      <TextField value={value} focusOnMount
        onChange={event => setValue(event.target.value)} />
    </Field>
    {error && <Field label="Błąd" description={error} />}
    {busy && <Field label="Zapisywanie…" />}
  </ConfirmModal>;
}

function DeleteModal({ title, onDelete, closeModal }: {
  title: string;
  onDelete: () => Promise<void>;
  closeModal?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <ConfirmModal strTitle={"Usunąć kartę „" + title + "”?"}
    strOKButtonText="Usuń"
    onCancel={closeModal}
    onEscKeypress={closeModal}
    onOK={() => {
      if (busy) return;
      setBusy(true);
      void onDelete().then(() => closeModal?.()).catch(() => {
        setError("Nie udało się usunąć karty.");
      }).finally(() => setBusy(false));
    }}>
    <Field label="Usunięta zostanie tylko karta"
      description="Kolekcje i pliki gier pozostaną bez zmian." />
    {error && <Field label="Błąd" description={error} />}
  </ConfirmModal>;
}

/**
 * Displayed by the native Steam library Menu button on a focused library tab.
 * No duplicate launcher, no extra "+" tab and no hard-coded focus colors.
 * Built-in Steam cards are preserved; edit/reorder/hide applies to Hub cards.
 */
export function LibraryCardsContextMenu({ selectedTabId }: { selectedTabId: string }) {
  const [tabs, setTabs] = useState<TabDefinition[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const selectedId = selectedTabId.startsWith("GameModeHub:")
    ? selectedTabId.slice("GameModeHub:".length) : "";
  const selected = tabs.find(tab => tab.id === selectedId);
  const index = tabs.findIndex(tab => tab.id === selectedId);
  const steamCollections = availableSteamCollections();
  const hubCollections = availableHubCollections();
  const systemTabs = availableSteamLibraryTabs();
  const selectedSystem = systemTabs.find(tab => tab.id === selectedTabId);

  useEffect(() => {
    let alive = true;
    Promise.all([readTabs(), listProfiles()]).then(([savedTabs, savedProfiles]) => {
      if (!alive) return;
      setTabs(savedTabs);
      setProfiles(savedProfiles);
    }).catch(() => {
      if (alive) setError("Nie można wczytać kart.");
    }).finally(() => {
      if (alive) setBusy(false);
    });
    return () => { alive = false; };
  }, []);

  async function mutate(change: (current: TabDefinition[]) => TabDefinition[]) {
    if (busy) return;
    const current = await readTabs();
    const next = change(current);
    const result = await saveTabs(next);
    setTabs(result);
    tabManagerTabsChanged(result);
  }

  async function add(title: string, filter: TabFilter, collectionId = "") {
    await mutate(current => current.length >= 64
      ? (() => { throw Error("Przekroczono limit kart."); })()
      : [...current, {
        id: newId(), title, hidden: false,
        filter, collection_id: collectionId
      }]);
  }

  async function move(id: string, offset: number) {
    await mutate(current => {
      const from = current.findIndex(item => item.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const copy = [...current];
      [copy[from], copy[to]] = [copy[to], copy[from]];
      return copy;
    });
  }

  function nameEditor(initial = "", id?: string) {
    showModal(<NameModal
      title={id ? "Zmień nazwę karty" : "Nowa karta"}
      initial={initial}
      onSave={async value => {
        if (id) await mutate(current => current.map(item =>
          item.id === id ? { ...item, title: value } : item));
        else await add(value, "all");
      }}
    />);
  }

  async function aliasSystemTab(title: string, originalId: string) {
    // Persist the Hub-owned duplicate FIRST. If hide fails the original remains
    // visible, so no system card or its content can disappear unexpectedly.
    const id = newId();
    await mutate(current => [...current, {
      id, title, hidden: false, filter: "system_tab", collection_id: originalId
    }]);
    try {
      await setSystemTabHidden(originalId, true);
    } catch (error) {
      // Leave the new visible alias in place; user may hide the original later.
      setError("Nowa karta została zapisana, ale nie można ukryć oryginału.");
    }
  }

  async function saveNamedProfile(name: string) {
    setProfiles(await saveProfile(name));
  }

  async function applyNamedProfile(name: string) {
    const stored = await loadProfile(name);
    setTabs(stored);
    tabManagerTabsChanged(stored);
  }

  return <Menu label={"Karty · " + (selected?.title ?? selectedSystem?.title ?? "Biblioteka")}>
    {error && <MenuItem disabled>{error}</MenuItem>}
    <MenuItem disabled={busy} onClick={() => nameEditor()}>
      Dodaj kartę
    </MenuItem>
    <MenuGroup label="Szybkie karty">
      <MenuItem disabled={busy} onClick={() => { void add("Wszystkie gry", "all"); }}>
        Wszystkie gry
      </MenuItem>
      <MenuItem disabled={busy} onClick={() => { void add("Zainstalowane", "installed"); }}>
        Zainstalowane
      </MenuItem>
      <MenuItem disabled={busy} onClick={() => { void add("Ulubione", "favorites"); }}>
        Ulubione
      </MenuItem>
      <MenuItem disabled={busy} onClick={() => { void add("Spoza Steam", "non_steam"); }}>
        Spoza Steam
      </MenuItem>
      {steamCollections.length > 0 && <MenuGroup label="Kolekcje Steam">
        {steamCollections.map(collection => <MenuItem key={collection.id}
          disabled={busy}
          onClick={() => { void add(collection.title, "collection", collection.id); }}>
          {collection.title}
        </MenuItem>)}
      </MenuGroup>}
      {hubCollections.length > 0 && <MenuGroup label="Kolekcje Huba">
        {hubCollections.map(collection => <MenuItem key={collection.id}
          disabled={busy}
          onClick={() => { void add(collection.title, "hub_collection", collection.id); }}>
          {collection.title}
        </MenuItem>)}
      </MenuGroup>}
    </MenuGroup>
    <MenuGroup label="Profile kart">
      <MenuItem disabled={busy} onClick={() => showModal(<NameModal
        title="Zapisz profil kart" onSave={saveNamedProfile} />)}>
        Utwórz profil
      </MenuItem>
      {profiles.map(name => <MenuGroup key={name} label={name}>
        <MenuItem disabled={busy} onClick={() => { void applyNamedProfile(name); }}>
          Wczytaj
        </MenuItem>
        <MenuItem disabled={busy} onClick={() => {
          void deleteProfile(name).then(setProfiles).catch(() => setError("Nie udało się usunąć profilu."));
        }}>
          Usuń profil
        </MenuItem>
      </MenuGroup>)}
    </MenuGroup>
    <MenuGroup label="Kolejność kart Huba">
      {tabs.filter(tab => !tab.hidden).map((tab, visibleIndex) => <MenuGroup key={tab.id} label={tab.title}>
        <MenuItem disabled={busy || visibleIndex === 0}
          onClick={() => { void move(tab.id, -1); }}>W lewo</MenuItem>
        <MenuItem disabled={busy || visibleIndex === tabs.filter(item => !item.hidden).length - 1}
          onClick={() => { void move(tab.id, 1); }}>W prawo</MenuItem>
      </MenuGroup>)}
      {!tabs.some(tab => !tab.hidden) && <MenuItem disabled>Brak własnych kart</MenuItem>}
    </MenuGroup>
    {selectedSystem && <>
      <MenuItem disabled={busy} onClick={() => showModal(<NameModal
        title={"Utwórz kartę Huba z „" + selectedSystem.title + "”"}
        initial={selectedSystem.title}
        onSave={title => aliasSystemTab(title, selectedSystem.id)} />)}>
        Utwórz własną wersję z nową nazwą
      </MenuItem>
      <MenuItem disabled={busy} onClick={() => {
        void setSystemTabHidden(selectedSystem.id, true).catch(() =>
          setError("Nie można ukryć ostatniej karty systemowej."));
      }}>Ukryj kartę systemową</MenuItem>
    </>}
    {selected && <>
      <MenuItem disabled={busy} onClick={() => nameEditor(selected.title, selected.id)}>
        Zmień nazwę
      </MenuItem>
      {selected.filter !== "system_tab" && <MenuGroup label="Filtr karty">
        {([
          ["all", "Wszystkie gry"], ["installed", "Zainstalowane"],
          ["favorites", "Ulubione"], ["non_steam", "Spoza Steam"]
        ] as Array<[TabFilter, string]>).map(([filter, label]) =>
          <MenuItem key={filter} disabled={busy}
            onClick={() => { void mutate(current => current.map(item => item.id === selected.id
              ? { ...item, filter, collection_id: "" } : item)); }}>
            {label}{selected.filter === filter ? " ✓" : ""}
          </MenuItem>)}
        {hubCollections.map(collection => <MenuItem key={collection.id}
          disabled={busy}
          onClick={() => { void mutate(current => current.map(item => item.id === selected.id
            ? { ...item, filter: "hub_collection", collection_id: collection.id } : item)); }}>
          {collection.title}
        </MenuItem>)}
      </MenuGroup>}
      <MenuItem disabled={busy || index <= 0} onClick={() => { void move(selected.id, -1); }}>
        Przesuń w lewo
      </MenuItem>
      <MenuItem disabled={busy || index >= tabs.length - 1}
        onClick={() => { void move(selected.id, 1); }}>
        Przesuń w prawo
      </MenuItem>
      <MenuItem disabled={busy} onClick={() => { void mutate(current =>
        current.map(item => item.id === selected.id ? { ...item, hidden: true } : item)); }}>
        Ukryj kartę
      </MenuItem>
      <MenuItem disabled={busy} onClick={() => showModal(<DeleteModal title={selected.title}
        onDelete={() => mutate(current => current.filter(item => item.id !== selected.id))} />)}>
        Usuń kartę
      </MenuItem>
    </>}
    {(tabs.some(tab => tab.hidden) || systemTabs.some(tab => tab.hidden)) && <MenuGroup label="Pokaż ukryte">
      {tabs.filter(tab => tab.hidden).map(tab => <MenuItem key={tab.id}
        disabled={busy}
        onClick={() => { void mutate(current => current.map(item =>
          item.id === tab.id ? { ...item, hidden: false } : item)); }}>
        {tab.title}
      </MenuItem>)}
      {systemTabs.filter(tab => tab.hidden).map(tab => <MenuItem key={tab.id}
        disabled={busy}
        onClick={() => { void setSystemTabHidden(tab.id, false).catch(() =>
          setError("Nie można pokazać karty Steam.")); }}>
        Steam · {tab.title}
      </MenuItem>)}
    </MenuGroup>}
  </Menu>;
}

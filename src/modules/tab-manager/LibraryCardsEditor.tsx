import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field, Toggle } from "@decky/ui";
import { HubTextInput } from "../../hub/HubTextInput";
import {
  type TabDefinition, type TabFilter,
  tabManagerTabsChanged,
  availableSteamCollections, availableHubCollections
} from "./LibraryIntegration";

const FILTER_LABELS: Record<TabFilter, string> = {
  all: "Wszystkie gry",
  installed: "Zainstalowane",
  favorites: "Ulubione",
  non_steam: "Spoza Steam",
  collection: "Kolekcja Steam",
  hub_collection: "Kolekcja Huba"
};
const SIMPLE_FILTERS: TabFilter[] = ["all", "installed", "favorites", "non_steam"];
const getTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const saveTabs = callable<[TabDefinition[]], TabDefinition[]>("save_tab_definitions");
const listProfiles = callable<[], string[]>("list_tab_profiles");
const saveProfile = callable<[string], string[]>("save_tab_profile");
const loadProfile = callable<[string], TabDefinition[]>("load_tab_profile");
const deleteProfile = callable<[string], string[]>("delete_tab_profile");

/** Cards in the Gaming Mode library. Independent of collection definitions. */
export function LibraryCardsEditor() {
  const [busy, setBusy] = useState(true);
  const [tabs, setTabs] = useState<TabDefinition[]>([]);
  const [name, setName] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([getTabs(), listProfiles()])
      .then(([definitions, savedProfiles]) => {
        if (mounted) {
          setTabs(definitions);
          setProfiles(savedProfiles);
        }
      }).catch(() => {
        if (mounted) setError("Nie udało się odczytać konfiguracji kart.");
      }).finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);

  async function persist(next: TabDefinition[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const stored = await saveTabs(next);
      setTabs(stored);
      tabManagerTabsChanged(stored);
      setDeleteId(null);
    } catch { setError("Błąd zapisu kart. Poprzednie ustawienia pozostają bez zmian."); }
    finally { setBusy(false); }
  }

  async function storeProfile() {
    const title = profileName.trim();
    if (!title || busy) return;
    setBusy(true); setError("");
    try { setProfiles(await saveProfile(title)); setProfileName(""); }
    catch { setError("Nie udało się zapisać profilu."); }
    finally { setBusy(false); }
  }

  async function applyProfile(title: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const newTabs = await loadProfile(title);
      setTabs(newTabs);
      tabManagerTabsChanged(newTabs);
    } catch { setError("Nie udało się wczytać profilu."); }
    finally { setBusy(false); }
  }

  async function removeProfile(title: string) {
    if (busy) return;
    setBusy(true); setError("");
    try { setProfiles(await deleteProfile(title)); }
    catch { setError("Nie udało się usunąć profilu."); }
    finally { setBusy(false); }
  }

  function addTab(title: string, filter: TabFilter = "all") {
    if (!title.trim()) return;
    const id = "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    void persist([...tabs, { id, title: title.trim(), hidden: false, filter, collection_id: "" }]);
    setName("");
  }

  function cycleFilter(tab: TabDefinition) {
    const options: TabFilter[] = [...SIMPLE_FILTERS];
    if (availableSteamCollections().length) options.push("collection");
    if (availableHubCollections().length) options.push("hub_collection");
    const next = options[(options.indexOf(tab.filter) + 1) % options.length];
    const collection_id = next === "collection" ? availableSteamCollections()[0].id
      : next === "hub_collection" ? availableHubCollections()[0].id : "";
    void persist(tabs.map(t => t.id === tab.id ? { ...t, filter: next, collection_id } : t));
  }

  function cycleCollection(tab: TabDefinition) {
    const options = tab.filter === "hub_collection" ? availableHubCollections() : availableSteamCollections();
    if (!options.length) return;
    const index = options.findIndex(c => c.id === tab.collection_id);
    const id = options[(index + 1) % options.length].id;
    void persist(tabs.map(t => t.id === tab.id ? { ...t, collection_id: id } : t));
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= tabs.length) return;
    const next = [...tabs];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Edycja kart biblioteki</DialogControlsSectionHeader>
    <Field label="Nazwa nowej karty">
      <HubTextInput value={name} disabled={busy} placeholder="Nazwa karty"
        onChange={event => setName(event.target.value)} onEditValue={setName} />
    </Field>
    <DialogButton disabled={busy || !name.trim() || tabs.length >= 64}
      onClick={() => addTab(name)}>Dodaj kartę</DialogButton>
    {tabs.map((tab, index) => <div key={tab.id}
      style={{ borderBottom: "1px solid rgba(255,255,255,.15)", padding: "8px 0" }}>
      {editingId === tab.id ? <>
        <Field label="Nowa nazwa karty">
          <HubTextInput value={editingTitle} disabled={busy}
            onChange={event => setEditingTitle(event.target.value)} onEditValue={setEditingTitle} />
        </Field>
        <DialogButton disabled={busy || !editingTitle.trim()} onClick={() => {
          void persist(tabs.map(t => t.id === tab.id ? { ...t, title: editingTitle.trim() } : t));
          setEditingId(null);
        }}>Zapisz nazwę</DialogButton>
        <DialogButton disabled={busy} onClick={() => setEditingId(null)}>Anuluj</DialogButton>
      </> : <Field label={tab.title} description={FILTER_LABELS[tab.filter]} />}
      <Field label="Widoczna">
        <Toggle value={!tab.hidden} disabled={busy} onChange={visible => void persist(
          tabs.map(t => t.id === tab.id ? { ...t, hidden: !visible } : t)
        )} />
      </Field>
      <DialogButton disabled={busy} onClick={() => { setEditingId(tab.id); setEditingTitle(tab.title); }}>Zmień nazwę</DialogButton>
      <DialogButton disabled={busy} onClick={() => cycleFilter(tab)}>
        Filtr: {FILTER_LABELS[tab.filter]}
      </DialogButton>
      {(tab.filter === "collection" || tab.filter === "hub_collection") &&
        <DialogButton disabled={busy} onClick={() => cycleCollection(tab)}>
          Kolekcja: {(tab.filter === "collection" ? availableSteamCollections() : availableHubCollections())
            .find(item => item.id === tab.collection_id)?.title ?? "Niedostępna"}
        </DialogButton>}
      <DialogButton disabled={busy || index === 0} onClick={() => move(index, -1)}>Wyżej</DialogButton>
      <DialogButton disabled={busy || index === tabs.length - 1} onClick={() => move(index, 1)}>Niżej</DialogButton>
      <DialogButton disabled={busy || tabs.length >= 64} onClick={() => {
        const id = "copy-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
        void persist([...tabs, { ...tab, id, title: tab.title + " (kopia)" }]);
      }}>Duplikuj</DialogButton>
      {deleteId === tab.id ? <>
        <Field label="Usunąć kartę?" description="Kolekcje i gry pozostaną bez zmian." />
        <DialogButton disabled={busy} onClick={() => void persist(tabs.filter(t => t.id !== tab.id))}>Potwierdź</DialogButton>
        <DialogButton disabled={busy} onClick={() => setDeleteId(null)}>Anuluj</DialogButton>
      </> : <DialogButton disabled={busy} onClick={() => setDeleteId(tab.id)}>Usuń kartę</DialogButton>}
    </div>)}
    {(tabs.length > 0 || profiles.length > 0) && <>
    <Field label="Profile kart" />
    <Field label="Nazwa profilu">
      <HubTextInput value={profileName} disabled={busy} placeholder="Nazwa układu"
        onChange={event => setProfileName(event.target.value)} onEditValue={setProfileName} />
    </Field>
    <DialogButton disabled={busy || !profileName.trim()} onClick={() => { void storeProfile(); }}>
      Zapisz układ
    </DialogButton>
    {profiles.map(profile => <Field key={profile} label={profile}>
      <DialogButton disabled={busy} onClick={() => void applyProfile(profile)}>Wczytaj</DialogButton>
      <DialogButton disabled={busy} onClick={() => void removeProfile(profile)}>Usuń profil</DialogButton>
    </Field>)}
    </>}
    {error && <Field label="Błąd" description={error} />}
  </DialogControlsSection>;
}

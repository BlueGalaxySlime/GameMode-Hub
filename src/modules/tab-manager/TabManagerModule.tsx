import { useEffect, useState } from "react";
import { ButtonItem, PanelSection, PanelSectionRow, TextField, ToggleField } from "@decky/ui";
import { callable } from "@decky/api";

import {
  TabDefinition, TabFilter, tabManagerEnabledChanged,
  tabManagerTabsChanged, tabManagerConflictChanged, detectTabMasterActivity,
  availableSteamCollections
} from "./LibraryIntegration";
import type { TabMasterActivity } from "./TabMasterDetection";

const FILTER_LABELS: Record<TabFilter, string> = {
  all: "Wszystkie gry",
  installed: "Zainstalowane",
  favorites: "Ulubione",
  non_steam: "Spoza Steam",
  collection: "Kolekcja Steam"
};
const SIMPLE_FILTERS: TabFilter[] = ["all", "installed", "favorites", "non_steam"];
const getEnabled = callable<[], boolean>("get_tab_manager_enabled");
const setEnabled = callable<[boolean], boolean>("set_tab_manager_enabled");
const getTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const saveTabs = callable<[TabDefinition[]], TabDefinition[]>("save_tab_definitions");
const listProfiles = callable<[], string[]>("list_tab_profiles");
const saveProfile = callable<[string], string[]>("save_tab_profile");
const loadProfile = callable<[string], TabDefinition[]>("load_tab_profile");
const deleteProfile = callable<[string], string[]>("delete_tab_profile");

/** Independent settings UI for the optional native library patch. */
export function TabManagerModule() {
  const [enabled, updateEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [tabMasterActivity, setTabMasterActivity] = useState<TabMasterActivity>("unknown");
  const [tabs, setTabs] = useState<TabDefinition[]>([]);
  const [name, setName] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [error, setError] = useState("");

  function refreshTabMaster() {
    const status = detectTabMasterActivity();
    setTabMasterActivity(status);
    tabManagerConflictChanged(status !== "inactive");
  }

  useEffect(() => {
    let mounted = true;
    refreshTabMaster();
    Promise.all([getEnabled(), getTabs(), listProfiles()])
      .then(([value, definitions, savedProfiles]) => { if (mounted) { updateEnabled(value); setTabs(definitions); setProfiles(savedProfiles); } })
      .catch(() => { if (mounted) setError("Nie udało się odczytać ustawień zakładek."); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);

  async function toggle(value: boolean) {
    setBusy(true);
    setError("");
    try {
      refreshTabMaster();
      const stored = await setEnabled(value);
      updateEnabled(stored);
      tabManagerEnabledChanged(stored);
    }
    catch { setError("Błąd zapisu ustawienia."); }
    finally { setBusy(false); }
  }

  async function persist(next: TabDefinition[]) {
    setBusy(true);
    setError("");
    try { const stored = await saveTabs(next); setTabs(stored); tabManagerTabsChanged(stored); }
    catch { setError("Błąd zapisu zakładek."); }
    finally { setBusy(false); }
  }

  async function storeProfile() {
    const title = profileName.trim();
    if (!title) return;
    setBusy(true);
    setError("");
    try { setProfiles(await saveProfile(title)); setProfileName(""); }
    catch { setError("Nie udało się zapisać profilu."); }
    finally { setBusy(false); }
  }

  async function applyProfile(title: string) {
    setBusy(true);
    setError("");
    try {
      const newTabs = await loadProfile(title);
      setTabs(newTabs);
      tabManagerTabsChanged(newTabs);
    } catch { setError("Nie udało się wczytać profilu."); }
    finally { setBusy(false); }
  }

  async function removeProfile(title: string) {
    setBusy(true);
    setError("");
    try { setProfiles(await deleteProfile(title)); }
    catch { setError("Nie udało się usunąć profilu."); }
    finally { setBusy(false); }
  }

  function duplicate(tab: TabDefinition) {
    const id = "copy-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
    void persist([...tabs, { ...tab, id, title: tab.title + " (kopia)" }]);
  }

  function add() {
    const title = name.trim();
    if (!title) return;
    const id = "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
    void persist([...tabs, { id, title, hidden: false, filter: "all", collection_id: "" }]);
    setName("");
  }

  function quickTab(title: string, filter: TabFilter) {
    const id = "quick-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
    void persist([...tabs, { id, title, hidden: false, filter, collection_id: "" }]);
  }

  function cycleFilter(tab: TabDefinition) {
    const collections = availableSteamCollections();
    const options: TabFilter[] = collections.length ? [...SIMPLE_FILTERS, "collection"] : SIMPLE_FILTERS;
    const index = options.indexOf(tab.filter);
    const next = options[(index + 1) % options.length];
    const collection_id = next === "collection" ? collections[0].id : "";
    void persist(tabs.map(item => item.id === tab.id ? { ...item, filter: next, collection_id } : item));
  }

  function cycleCollection(tab: TabDefinition) {
    const collections = availableSteamCollections();
    if (!collections.length) return;
    const current = collections.findIndex(collection => collection.id === tab.collection_id);
    const collection_id = collections[(current + 1) % collections.length].id;
    void persist(tabs.map(item => item.id === tab.id ? { ...item, collection_id } : item));
  }

  function rename(id: string) {
    const title = editingTitle.trim();
    if (!title) return;
    void persist(tabs.map(tab => tab.id === id ? { ...tab, title } : tab));
    setEditingId(null);
    setEditingTitle("");
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= tabs.length) return;
    const next = [...tabs];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  return <PanelSection title="Moduły · Tab Manager">
    <PanelSectionRow>
      <ToggleField label="Tab Manager" checked={enabled} disabled={busy} onChange={toggle} />
    </PanelSectionRow>
    {tabMasterActivity === "active" && <PanelSectionRow><div>TabMaster jest uruchomiony. Wyłącz go w Decky, aby używać zakładek SteamHub.</div></PanelSectionRow>}
    {tabMasterActivity === "unknown" && <PanelSectionRow><div>Nie można odczytać stanu TabMastera w Decky. Integracja biblioteki pozostaje wstrzymana.</div></PanelSectionRow>}
    {tabMasterActivity !== "inactive" && <PanelSectionRow><ButtonItem disabled={busy} onClick={refreshTabMaster}>Sprawdź ponownie stan TabMastera</ButtonItem></PanelSectionRow>}
    {enabled && <>
      <PanelSectionRow><TextField label="Nazwa zakładki" value={name} onChange={event => setName(event.target.value)} /></PanelSectionRow>
      <PanelSectionRow><ButtonItem disabled={busy || !name.trim()} onClick={add}>Dodaj zakładkę</ButtonItem></PanelSectionRow>
      <PanelSectionRow><ButtonItem disabled={busy} onClick={() => quickTab("Zainstalowane", "installed")}>Quick Tab · Zainstalowane</ButtonItem></PanelSectionRow>
      <PanelSectionRow><ButtonItem disabled={busy} onClick={() => quickTab("Ulubione", "favorites")}>Quick Tab · Ulubione</ButtonItem></PanelSectionRow>
      {tabs.map((tab, index) => <PanelSectionRow key={tab.id}>
        {editingId === tab.id ? <>
          <TextField label="Nowa nazwa" value={editingTitle} onChange={event => setEditingTitle(event.target.value)} />
          <ButtonItem disabled={busy || !editingTitle.trim()} onClick={() => rename(tab.id)}>Zapisz nazwę</ButtonItem>
          <ButtonItem disabled={busy} onClick={() => setEditingId(null)}>Anuluj</ButtonItem>
        </> : <>
          <div>{tab.title}</div>
          <ButtonItem disabled={busy} onClick={() => { setEditingId(tab.id); setEditingTitle(tab.title); }}>Zmień nazwę</ButtonItem>
        </>}
        <ButtonItem disabled={busy} onClick={() => cycleFilter(tab)}>Filtr: {FILTER_LABELS[tab.filter] ?? "Wszystkie gry"}</ButtonItem>
        {tab.filter === "collection" && <ButtonItem disabled={busy} onClick={() => cycleCollection(tab)}>
          Kolekcja: {availableSteamCollections().find(item => item.id === tab.collection_id)?.title ?? "Niedostępna"}
        </ButtonItem>}
        <ToggleField label="Widoczna" checked={!tab.hidden} disabled={busy} onChange={visible => void persist(tabs.map(t => t.id === tab.id ? { ...t, hidden: !visible } : t))} />
        <ButtonItem disabled={busy || index === 0} onClick={() => move(index, -1)}>W górę</ButtonItem>
        <ButtonItem disabled={busy || index === tabs.length - 1} onClick={() => move(index, 1)}>W dół</ButtonItem>
        <ButtonItem disabled={busy} onClick={() => duplicate(tab)}>Duplikuj</ButtonItem>
        <ButtonItem disabled={busy} onClick={() => void persist(tabs.filter(t => t.id !== tab.id))}>Usuń</ButtonItem>
      </PanelSectionRow>)}
      <PanelSectionRow><div>Profile zakładek</div></PanelSectionRow>
      <PanelSectionRow><TextField label="Nazwa profilu" value={profileName} onChange={event => setProfileName(event.target.value)} /></PanelSectionRow>
      <PanelSectionRow><ButtonItem disabled={busy || !profileName.trim()} onClick={storeProfile}>Zapisz aktualny układ jako profil</ButtonItem></PanelSectionRow>
      {profiles.map(profile => <PanelSectionRow key={profile}>
        <div>{profile}</div>
        <ButtonItem disabled={busy} onClick={() => applyProfile(profile)}>Wczytaj</ButtonItem>
        <ButtonItem disabled={busy} onClick={() => removeProfile(profile)}>Usuń profil</ButtonItem>
      </PanelSectionRow>)}
    </>}

    {error && <PanelSectionRow><div role="alert">{error}</div></PanelSectionRow>}
  </PanelSection>;
}

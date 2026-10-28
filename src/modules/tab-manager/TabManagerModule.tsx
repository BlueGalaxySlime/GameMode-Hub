import { useEffect, useState } from "react";
import { ButtonItem, PanelSection, PanelSectionRow, TextField, ToggleField } from "@decky/ui";
import { callable } from "@decky/api";

import {
  TabDefinition, TabFilter, tabManagerEnabledChanged,
  tabManagerTabsChanged, tabManagerConflictChanged
} from "./LibraryIntegration";

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
const detectTabMaster = callable<[], boolean>("get_tabmaster_installed");
const getTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const saveTabs = callable<[TabDefinition[]], TabDefinition[]>("save_tab_definitions");

/** Independent Tab Manager UI. Does not patch Steam's library until the engine is ready. */
export function TabManagerModule() {
  const [enabled, updateEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [tabs, setTabs] = useState<TabDefinition[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    detectTabMaster().then(value => { if (mounted) { setConflict(value); tabManagerConflictChanged(value); } }).catch(() => {});
    Promise.all([getEnabled(), getTabs()])
      .then(([value, definitions]) => { if (mounted) { updateEnabled(value); setTabs(definitions); } })
      .catch(() => { if (mounted) setError("Nie udało się odczytać ustawień zakładek."); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);

  async function toggle(value: boolean) {
    setBusy(true);
    setError("");
    try { const stored = await setEnabled(value); updateEnabled(stored); tabManagerEnabledChanged(stored); }
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
    const index = SIMPLE_FILTERS.indexOf(tab.filter);
    const next = SIMPLE_FILTERS[(index + 1) % SIMPLE_FILTERS.length];
    void persist(tabs.map(item => item.id === tab.id ? { ...item, filter: next, collection_id: "" } : item));
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
    {conflict && <PanelSectionRow><div>Wykryto TabMaster. Równoczesne zarządzanie zakładkami może powodować konflikt.</div></PanelSectionRow>}
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
        <ToggleField label="Widoczna" checked={!tab.hidden} disabled={busy} onChange={visible => void persist(tabs.map(t => t.id === tab.id ? { ...t, hidden: !visible } : t))} />
        <ButtonItem disabled={busy || index === 0} onClick={() => move(index, -1)}>W górę</ButtonItem>
        <ButtonItem disabled={busy || index === tabs.length - 1} onClick={() => move(index, 1)}>W dół</ButtonItem>
        <ButtonItem disabled={busy} onClick={() => void persist(tabs.filter(t => t.id !== tab.id))}>Usuń</ButtonItem>
      </PanelSectionRow>)}
    </>}
    {conflict && enabled && <PanelSectionRow><div>Integracja z biblioteką jest wstrzymana, dopóki wykrywany jest TabMaster.</div></PanelSectionRow>}
    {error && <PanelSectionRow><div role="alert">{error}</div></PanelSectionRow>}
  </PanelSection>;
}

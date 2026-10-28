import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import {
  tabManagerTabsChanged, hubCollectionsChanged, hiddenSteamTabsChanged, type TabDefinition
} from "../modules/tab-manager/LibraryIntegration";
import type { HubCollection } from "../modules/collection-manager/CollectionsModule";

type Backup = {
  id: string;
  created_at: string;
  kind: "manual" | "before_restore";
  tabs: number;
  collections: number;
  profiles: number;
};
const list = callable<[], Backup[]>("get_hub_library_backups");
const create = callable<[], Backup>("create_hub_library_backup");
const restore = callable<[string], { ok: boolean; safety_backup: string }>("restore_hub_library_backup");
const readTabs = callable<[], TabDefinition[]>("get_tab_definitions");
const readHidden = callable<[], string[]>("get_hidden_steam_tabs");
const readCollections = callable<[], HubCollection[]>("get_hub_collections");

function dateOf(item: Backup) {
  const date = new Date(item.created_at);
  return Number.isNaN(date.valueOf()) ? "Nieznana data" : date.toLocaleString("pl-PL");
}

/** Local, versioned snapshots: no credentials, game installation or system files. */
export function LibraryBackupSection() {
  const [items, setItems] = useState<Backup[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    list().then(value => { if (alive) setItems(value); })
      .catch(() => { if (alive) setError("Nie można odczytać kopii zapasowych."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  async function createNow() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const backup = await create();
      setItems(await list());
      setMessage("Zapisano kopię: " + dateOf(backup));
    } catch { setError("Nie udało się utworzyć kopii."); }
    finally { setBusy(false); }
  }

  async function restoreNow(id: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await restore(id);
      const [tabs, collections, hidden, backups] = await Promise.all([readTabs(), readCollections(), readHidden(), list()]);
      tabManagerTabsChanged(tabs);
      hubCollectionsChanged(collections);
      hiddenSteamTabsChanged(hidden);
      setItems(backups);
      setConfirmId(null);
      setMessage(result.ok ? "Przywrócono ustawienia. Automatycznie zapisano również stan sprzed przywrócenia."
        : "Nie udało się potwierdzić przywrócenia.");
    } catch { setError("Przywracanie nie powiodło się. Sprawdź dostępne kopie."); }
    finally { setBusy(false); }
  }

  return <DialogControlsSection>
    <DialogControlsSectionHeader>Kopia zapasowa</DialogControlsSectionHeader>
    <Field label="Karty, kolekcje i profile"
      description="Kopie na dysku przetrwają aktualizacje Huba. Bez gier i danych logowania.">
      <DialogButton disabled={busy} onClick={() => { void createNow(); }}>
        Utwórz kopię
      </DialogButton>
    </Field>
    <Field label="Przywracanie">
      <DialogButton disabled={busy} onClick={() => setExpanded(value => !value)}>
        {expanded ? "Ukryj" : "Wybierz kopię"}
      </DialogButton>
    </Field>
    {expanded && <>
      {!items.length && <Field label="Brak zapisanych kopii" />}
      {items.map(item => <Field key={item.id}
        label={dateOf(item)}
        description={item.tabs + " kart · " + item.collections + " kolekcji · " +
          item.profiles + " profili" + (item.kind === "before_restore" ? " · przed przywróceniem" : "")}>
        <DialogButton disabled={busy} onClick={() => setConfirmId(item.id)}>
          Przywróć
        </DialogButton>
      </Field>)}
      {confirmId && <Field label="Potwierdź przywrócenie"
        description="Zastąpi bieżący układ kart, kolekcji i profili. Przed zmianą utworzymy dodatkową kopię.">
        <DialogButton disabled={busy} onClick={() => { void restoreNow(confirmId); }}>
          Potwierdź
        </DialogButton>
        <DialogButton disabled={busy} onClick={() => setConfirmId(null)}>Anuluj</DialogButton>
      </Field>}
    </>}
    {error && <Field label="Błąd" description={error} />}
    {message && <Field label="Zapis" description={message} />}
  </DialogControlsSection>;
}

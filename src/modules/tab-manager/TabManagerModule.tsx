import { useEffect, useState } from "react";
import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { callable } from "@decky/api";

const getEnabled = callable<[], boolean>("get_tab_manager_enabled");
const setEnabled = callable<[boolean], boolean>("set_tab_manager_enabled");
const detectTabMaster = callable<[], boolean>("get_tabmaster_installed");

/** Self-contained module UI. No library patch is installed until the engine is ready. */
export function TabManagerModule() {
  const [enabled, updateEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    detectTabMaster().then(value => { if (mounted) setConflict(value); }).catch(() => {});
    getEnabled().then(value => { if (mounted) updateEnabled(value); })
      .catch(() => { if (mounted) setError("Błąd odczytu ustawienia."); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);

  async function toggle(value: boolean) {
    setBusy(true);
    setError("");
    try { updateEnabled(await setEnabled(value)); }
    catch { setError("Błąd zapisu ustawienia."); }
    finally { setBusy(false); }
  }

  return <PanelSection title="Moduły · Tab Manager">
    <PanelSectionRow>
      <ToggleField label="Tab Manager" checked={enabled} disabled={busy} onChange={toggle} />
    </PanelSectionRow>
    {conflict && <PanelSectionRow><div>Wykryto TabMaster. Równoczesne zarządzanie zakładkami może powodować konflikt.</div></PanelSectionRow>}
    <PanelSectionRow><div>Mechanizm zarządzania zakładkami jest w przygotowaniu. Przełącznik obecnie zapisuje wybór.</div></PanelSectionRow>
    {error && <PanelSectionRow><div role="alert">{error}</div></PanelSectionRow>}
  </PanelSection>;
}

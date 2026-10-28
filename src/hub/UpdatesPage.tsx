import { useRef } from "react";
import { DialogBody, DialogButton, DialogControlsSection, Focusable,
  NavEntryPositionPreferences, showModal } from "@decky/ui";
import { useHubSessionState } from "./useHubSessionState";
import { useFlatpakChecks } from "./flatpakChecks";
import { UpdaterPage } from "./UpdaterPage";
import { FlatpakManagerDialog } from "./FlatpakManagerDialog";

type Section = "hub" | "flatpak" | "other";

/** Hub hotfixes keep their original installation flow. Providers stay separate. */
export function UpdatesPage() {
  const [section, setSection] = useHubSessionState<Section>("updates.section", "hub");
  const modalOpen = useRef(false);

  function openFlatpak() {
    if (modalOpen.current) return;
    modalOpen.current = true;
    window.setTimeout(() => {
      try {
        const dialog = showModal(<FlatpakManagerDialog />);
        void dialog.ClosedPromise.finally(() => { modalOpen.current = false; });
      } catch { modalOpen.current = false; }
    }, 0);
  }

  return <div style={{ width: "100%", minWidth: 0 }}>
    <Focusable flow-children="row"
      navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
      style={{ display: "flex", flexDirection: "row", gap: 8, padding: "8px 12px" }}>
      <DialogButton preferredFocus={section === "hub"} style={{ flex: "1 1 0", minWidth: 0 }}
        onClick={() => setSection("hub")}>Hub</DialogButton>
      <DialogButton preferredFocus={section === "flatpak"} style={{ flex: "1 1 0", minWidth: 0 }}
        onClick={() => setSection("flatpak")}>Flatpak</DialogButton>
      <DialogButton preferredFocus={section === "other"} style={{ flex: "1 1 0", minWidth: 0 }}
        onClick={() => setSection("other")}>Pozostałe</DialogButton>
    </Focusable>
    {section === "hub" ? <UpdaterPage /> :
      section === "flatpak" ? <FlatpakUpdatesTab onManage={openFlatpak} /> :
      <DialogBody><DialogControlsSection>
        <div style={{ padding: 12, fontSize: 13 }}>
          Kolejne źródła aktualizacji będą dodawane osobno. Obecnie nic tutaj nie jest sprawdzane.
        </div>
      </DialogControlsSection></DialogBody>}
  </div>;
}

function FlatpakUpdatesTab({ onManage }: { onManage: () => void }) {
  const { data, refresh } = useFlatpakChecks();
  const message = !data || data.state === "never" ? "Jeszcze nie sprawdzano" :
    data.state === "checking" ? "Sprawdzanie w tle…" :
    data.state === "error" ? data.error || "Błąd sprawdzania" :
    data.count ? "Dostępne aktualizacje: " + data.count : "Brak aktualizacji";
  return <DialogBody><DialogControlsSection>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 12px" }}>
      <div>{message}</div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>
        Ostatnie sprawdzenie: {data?.checked_at
          ? new Date(data.checked_at * 1000).toLocaleString("pl-PL") : "nigdy"}
      </div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>
        Kolejne: {data?.next_check_at
          ? new Date(data.next_check_at * 1000).toLocaleString("pl-PL") : "na żądanie"}
      </div>
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        <DialogButton disabled={data?.state === "checking"}
          onClick={() => refresh(true)}>Sprawdź teraz</DialogButton>
        <DialogButton onClick={onManage}>Zarządzaj aktualizacjami</DialogButton>
      </Focusable>
    </div>
  </DialogControlsSection></DialogBody>;
}

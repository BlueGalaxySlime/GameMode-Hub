import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Field, Focusable,
  ModalRoot, NavEntryPositionPreferences, showModal
} from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { isDownloadActive, useDownloads } from "./downloads";

const statusRpc = callable<[], { installed: boolean; app_id: string; installations: string[] }>("heroic_get_status");
const installRpc = callable<[], { id: number }>("downloads_install_heroic");
const HEROIC_ID = "com.heroicgameslauncher.hgl";

function ConfirmHeroicInstall({ onConfirm, closeModal }: {
  onConfirm: () => Promise<void>;
  closeModal?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      closeModal?.();
    } catch (reason) {
      setError("Nie udało się rozpocząć instalacji: " + String(reason));
    } finally {
      setBusy(false);
    }
  }

  return <ModalRoot onCancel={() => { if (!busy) closeModal?.(); }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12,
      padding: 12, width: "min(86vw, 520px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Zainstalować Heroic Games Launcher?</strong>
      <div>Flatpak z Flathub ({HEROIC_ID}) zostanie zainstalowany dla bieżącego
        użytkownika. Jeśli trzeba, Hub doda repozytorium Flathub tylko dla tego użytkownika.
        Bez uprawnień root i bez zmiany instalacji systemowych.</div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Postęp i anulowanie: zakładka Pobieranie. Aplikacja będzie wykrywana w Pulpicie.
      </div>
      {!!error && <div role="alert" style={{ fontSize: 12 }}>{error}</div>}
      <Focusable flow-children="row" navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{ display: "flex", flexDirection: "row", gap: 8 }}>
        <DialogButton preferredFocus disabled={busy} style={{ flex: "1 1 0" }}
          onClick={() => closeModal?.()}>Anuluj</DialogButton>
        <DialogButton disabled={busy} style={{ flex: "1 1 0" }}
          onClick={() => { void confirm(); }}>Instaluj</DialogButton>
      </Focusable>
    </div>
  </ModalRoot>;
}

export function HubAddonsPage() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [installations, setInstallations] = useState<string[]>([]);
  const [error, setError] = useState("");
  const dialogOpen = useRef(false);
  const { jobs } = useDownloads();
  const heroicJob = jobs.find(job => job.kind === "heroic");
  const pending = !!heroicJob && isDownloadActive(heroicJob);
  const installationLabel = installations.includes("user") &&
    installations.some(value => value !== "user") ? "użytkownika i systemowy" :
    installations.includes("user") ? "użytkownika" : "systemowy";

  async function refresh() {
    try {
      const status = await withTimeout(statusRpc(), 6000);
      setInstalled(status.installed);
      setInstallations(status.installations ?? []);
      setError("");
    } catch (reason) {
      setError("Nie można sprawdzić instalacji Flatpak: " + String(reason));
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (heroicJob?.state === "success") void refresh();
  }, [heroicJob?.state]);

  function confirmInstall() {
    if (installed || pending || dialogOpen.current) return;
    dialogOpen.current = true;
    window.setTimeout(() => {
      try {
        const modal = showModal(<ConfirmHeroicInstall onConfirm={async () => {
          await withTimeout(installRpc(), 8000);
          window.dispatchEvent(new Event("gamemodehub-downloads-changed"));
        }} />);
        void modal.ClosedPromise.finally(() => { dialogOpen.current = false; });
      } catch {
        dialogOpen.current = false;
        setError("Nie udało się otworzyć potwierdzenia instalacji.");
      }
    }, 0);
  }

  return <DialogBody>
    <DialogControlsSection>
      <Focusable flow-children="column" style={{ display: "flex",
        flexDirection: "column", gap: 12, width: "100%", minWidth: 0 }}>
        <strong>Powiązane aplikacje</strong>
        <Field label="Heroic Games Launcher"
          description={installed ? "Zainstalowany · Flatpak " + installationLabel :
            pending ? "Instalacja trwa · szczegóły w Pobieraniu" :
            "Launcher gier Epic i GOG · Flatpak z Flathub"}>
          <DialogButton disabled={installed !== false || pending}
            onClick={confirmInstall}>{installed ? "Zainstalowany" :
              pending ? "W kolejce / instalowanie" : "Instaluj"}</DialogButton>
        </Field>
        {!!heroicJob && !installed && <div style={{ fontSize: 12, opacity: 0.8 }}>
          {heroicJob.message}
        </div>}
        {!!error && <div role="alert">{error}</div>}
        <DialogButton onClick={() => { void refresh(); }}>Odśwież stan</DialogButton>
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

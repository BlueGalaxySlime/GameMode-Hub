import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import { DialogButton, ModalRoot } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";

type TransferStatus = {
  active: boolean; url: string | null; pin: string | null;
  folder: string | null; expiresIn: number;
};
const transferStatus = callable<[], TransferStatus>("transfer_status");
const transferStart = callable<[], TransferStatus>("transfer_start");
const transferStop = callable<[], { active: boolean }>("transfer_stop");
const transferShare = callable<[string], { name: string }>("transfer_share");

export function TransferDialog({ selectedFile, closeModal }: {
  selectedFile?: string;
  closeModal?: () => void;
}) {
  const [status, setStatus] = useState<TransferStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void withTimeout(transferStatus(), 6000)
      .then(value => { if (mounted) setStatus(value); })
      .catch(() => { if (mounted) setMessage("Nie można pobrać stanu transferu."); });
    return () => { mounted = false; };
  }, []);

  async function start() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      setStatus(await withTimeout(transferStart(), 8000));
    } catch (reason) {
      setMessage("Nie udało się uruchomić transferu: " + String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (busy) return;
    setBusy(true);
    try {
      await withTimeout(transferStop(), 8000);
      setStatus({ active: false, url: null, pin: null, folder: null, expiresIn: 0 });
      setMessage("Transfer zatrzymany.");
    } catch {
      setMessage("Nie udało się zatrzymać transferu.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!selectedFile || busy || !status?.active) return;
    setBusy(true);
    setMessage("");
    try {
      const file = await withTimeout(transferShare(selectedFile), 8000);
      setMessage("Udostępniono „" + file.name + "”. Na Macu wybierz „Odśwież listę”.");
    } catch (reason) {
      setMessage("Nie udostępniono pliku: " + String(reason));
    } finally {
      setBusy(false);
    }
  }

  const name = selectedFile?.split("/").pop();

  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12,
      width: "min(84vw, 520px)", maxWidth: "100%", boxSizing: "border-box",
      overflowWrap: "anywhere" }}>
      <strong>Transfer Wi-Fi — Mac i Steam Deck</strong>
      <div style={{ fontSize: 12 }}>
        Bez logowania roota, SSH i dodatkowego programu. Oba urządzenia muszą być
        w tej samej zaufanej sieci Wi-Fi.
      </div>
      {status?.active ? <>
        <div>Na Macu lub drugim komputerze otwórz w przeglądarce:</div>
        <div style={{ fontWeight: 700, fontSize: 16, userSelect: "text" }}>{status.url}</div>
        <div>Kod parowania: <strong style={{ fontSize: 20, letterSpacing: 2 }}>
          {status.pin}
        </strong></div>
        <div style={{ fontSize: 12 }}>Otrzymane pliki: {status.folder}</div>
        <div style={{ fontSize: 12 }}>
          Pozostały czas: około {Math.ceil(status.expiresIn / 60)} min.
          Sesja zamyka się również po wyłączeniu Huba.
        </div>
        {name && <DialogButton disabled={busy} onClick={() => { void share(); }}>
          {"Udostępnij wybrany plik: " + name}
        </DialogButton>}
        <DialogButton disabled={busy} onClick={() => { void stop(); }}>
          Zatrzymaj transfer
        </DialogButton>
      </> : <>
        <div style={{ fontSize: 12 }}>
          Po uruchomieniu Hub udostępni wyłącznie folder odbiorczy i pliki,
          które wskażesz w Plikach. Nikt nie otrzyma dostępu do całego dysku.
        </div>
        <DialogButton disabled={busy} onClick={() => { void start(); }}>
          Uruchom transfer
        </DialogButton>
      </>}
      <div style={{ fontSize: 11, opacity: 0.8 }}>
        Uwaga: lokalne połączenie HTTP nie jest szyfrowane. Nie używaj go
        w publicznej ani niezaufanej sieci.
      </div>
      {!!message && <div role="status" style={{ fontSize: 12 }}>{message}</div>}
    </div>
  </ModalRoot>;
}

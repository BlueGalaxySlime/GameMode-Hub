import { useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection,
  DialogControlsSectionHeader, Field
} from "@decky/ui";
import { RequestTimeoutError, withTimeout } from "../utils/withTimeout";

const VERSION = "0.4.5";
type UpdateResult = {
  current: string;
  latest: string | null;
  url: string | null;
  sha256: string | null;
  available: boolean;
  status: "ok" | "no_releases" | "error";
  error?: string | null;
};
type DeckyInstaller = {
  callable: (method: string) => (...args: unknown[]) => Promise<unknown>;
};
const checkUpdates = callable<[], UpdateResult>("check_updates");

async function checkBrowser(): Promise<UpdateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch("https://api.github.com/repos/BlueGalaxySlime/SteamOS-Hub/releases/latest",
      { signal: controller.signal, cache: "no-store", headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error("GitHub HTTP " + response.status);
    const data = await response.json();
    const latest = String(data.tag_name ?? "").replace(/^v/, "");
    const asset = Array.isArray(data.assets)
      ? data.assets.find((a: { name?: string }) => a.name === "SteamHub.zip") : undefined;
    const url = typeof asset?.browser_download_url === "string" &&
      asset.browser_download_url.startsWith("https://github.com/BlueGalaxySlime/SteamOS-Hub/releases/download/")
      ? asset.browser_download_url : null;
    const sha256 = typeof asset?.digest === "string" && /^sha256:[a-fA-F0-9]{64}$/.test(asset.digest)
      ? asset.digest.slice(7) : null;
    const parse = (v: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v)?.slice(1).map(Number);
    const a = parse(latest), b = parse(VERSION);
    const newer = !!a && !!b && (a[0] > b[0] || (a[0] === b[0] &&
      (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))));
    return { current: VERSION, latest, url, sha256, available: !!(newer && url && sha256), status: "ok" };
  } finally { clearTimeout(timer); }
}


export function UpdaterPage() {
  const [message, setMessage] = useState("Aktualizacje są sprawdzane tylko po wybraniu przycisku.");
  const [candidate, setCandidate] = useState<UpdateResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const busy = useRef(false);

  async function check() {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setCandidate(null);
    setMessage("Sprawdzanie aktualizacji…");
    try {
      let result: UpdateResult;
      try {
        result = await checkBrowser();
      } catch (browserError) {
        try {
          result = await withTimeout(checkUpdates(), 8000);
        } catch (backendError) {
          throw new Error("Brak połączenia z GitHub przez Steam i Decky: " +
            String(browserError) + "; " + String(backendError));
        }
      }
      if (result.status === "error") setMessage(result.error ?? "Nie udało się sprawdzić aktualizacji.");
      else if (result.status === "no_releases") setMessage(result.error ?? "Brak wydań na GitHubie.");
      else if (result.available) {
        setCandidate(result);
        setMessage("Dostępna wersja " + result.latest + ".");
      } else {
        setMessage(result.latest && result.latest !== VERSION
          ? "Wydanie " + result.latest + " nie jest nowsze lub nie ma poprawnej sumy SHA-256."
          : "SteamHub " + VERSION + " jest aktualny.");
      }
    } catch (error) {
      setMessage(error instanceof RequestTimeoutError
        ? "Serwer nie odpowiedział w wyznaczonym czasie. Możesz spróbować ponownie."
        : "Błąd sprawdzania: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLastChecked(new Date().toLocaleString("pl-PL"));
      busy.current = false;
      setChecking(false);
    }
  }

  async function install() {
    if (busy.current || !candidate?.available || !candidate.url || !candidate.latest || !candidate.sha256) return;
    const decky = (window as Window & { DeckyBackend?: DeckyInstaller }).DeckyBackend;
    if (typeof decky?.callable !== "function") {
      setMessage("Instalator Decky jest niedostępny. Użyj Decky → Developer → Install Plugin from URL.");
      return;
    }
    busy.current = true;
    setChecking(true);
    setMessage("Przekazywanie aktualizacji do Decky Loader…");
    try {
      await withTimeout(
        decky.callable("utilities/install_plugin")(candidate.url, "SteamHub", candidate.latest, candidate.sha256, 2),
        30000
      );
      setCandidate(null);
      setMessage("Żądanie instalacji zostało przyjęte przez Decky Loader. Potwierdź instalację, jeśli Decky wyświetli okno.");
    } catch (error) {
      setMessage(error instanceof RequestTimeoutError
        ? "Decky nie potwierdził instalacji w ciągu 30 sekund. Sprawdź wersję w Decky przed ponowieniem, aby nie uruchomić dwóch instalacji."
        : "Instalacja nie powiodła się: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Aktualizacje SteamHub</DialogControlsSectionHeader>
      <Field label="Zainstalowana wersja" description={"SteamHub " + VERSION} />
      <Field label="Sprawdź aktualizacje" description="Sprawdzanie odbywa się ręcznie w GitHub Releases.">
        <DialogButton disabled={checking} onClick={() => { void check(); }}>
          {checking ? "Czekaj…" : "Sprawdź"}
        </DialogButton>
      </Field>
      {candidate?.available && <Field label={"Wersja " + candidate.latest}>
        <DialogButton disabled={checking} onClick={() => { void install(); }}>Aktualizuj</DialogButton>
      </Field>}
      <Field label="Stan aktualizacji" description={message} />
      {lastChecked && <Field label="Ostatnie sprawdzenie" description={lastChecked} />}
    </DialogControlsSection>
  </DialogBody>;
}

import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  DialogBody, DialogButton, DialogControlsSection,
  DialogControlsSectionHeader, Field, Navigation, SidebarNavigation, Toggle
} from "@decky/ui";
import { callable } from "@decky/api";
import { FaFolderOpen, FaHeart, FaHome, FaPlug, FaPuzzlePiece, FaSyncAlt, FaTerminal } from "react-icons/fa";
import { withTimeout } from "../utils/withTimeout";
import { UpdaterPage } from "./UpdaterPage";
import { DeckyTerminalPage } from "./DeckyTerminalAdapter";
import { CreditsPage } from "./CreditsPage";

type InstalledAddon = {
  name: string;
  version?: string;
  disabled: boolean;
};

type DeckyBackendAPI = {
  callable: (method: string) => (...args: unknown[]) => Promise<unknown>;
};

const getSelection = callable<[], string[]>("get_selected_addons");
const saveSelection = callable<[string[]], string[]>("set_selected_addons");

async function listInstalledAddons(): Promise<InstalledAddon[]> {
  const backend = (window as Window & { DeckyBackend?: DeckyBackendAPI }).DeckyBackend;
  if (!backend || typeof backend.callable !== "function") {
    throw new Error("Decky nie udostępnia listy dodatków.");
  }
  const response = await withTimeout(backend.callable("loader/get_plugins")(), 10000);
  if (!Array.isArray(response)) throw new Error("Nieprawidłowa odpowiedź Decky.");
  return response.filter((plugin: unknown): plugin is InstalledAddon => {
    return typeof plugin === "object" && plugin !== null &&
      typeof (plugin as InstalledAddon).name === "string" &&
      (plugin as InstalledAddon).name !== "SteamHub";
  }).map(plugin => ({
    name: plugin.name,
    disabled: plugin.disabled === true,
    version: typeof plugin.version === "string" ? plugin.version : undefined
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function Overview({ selected, installed }: {
  selected: string[];
  installed: InstalledAddon[];
}) {
  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>SteamHub</DialogControlsSectionHeader>
      <Field label="Moje dodatki" description="Wybrane dodatki pojawiają się w menu po lewej stronie.">
        <div>{selected.length}</div>
      </Field>
      {selected.map(name => {
        const addon = installed.find(plugin => plugin.name === name);
        return <Field key={name} label={name}
          description={addon ? (addon.disabled ? "Wyłączony w Decky" : "Zainstalowany i aktywny") : "Niedostępny"}>
          <DialogButton onClick={() => Navigation.Navigate("/steamhub/addon/" + encodeURIComponent(name))}>
            Opcje
          </DialogButton>
        </Field>;
      })}
      {!selected.length && <Field label="Brak wybranych dodatków"
        description="Otwórz Dodatki, aby wybrać te, które mają być widoczne w SteamHub." />}
    </DialogControlsSection>
  </DialogBody>;
}

function AddonSelector({ installed, selected, pending, error, toggle, reload }: {
  installed: InstalledAddon[];
  selected: string[];
  pending: boolean;
  error: string;
  toggle: (name: string, show: boolean) => void;
  reload: () => void;
}) {
  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Dodatki Decky</DialogControlsSectionHeader>
      <Field label="Odśwież listę dodatków" description="Wybór nie instaluje, nie uruchamia i nie wyłącza innych wtyczek.">
        <DialogButton disabled={pending} onClick={reload}>Odśwież</DialogButton>
      </Field>
      {installed.map(plugin => <Field key={plugin.name} label={plugin.name}
        description={plugin.disabled ? "Wyłączony w Decky" : (plugin.version ? "Wersja " + plugin.version : "Aktywny")}>
        <Toggle value={selected.includes(plugin.name)} disabled={pending}
          onChange={value => toggle(plugin.name, value)} />
      </Field>)}
      {error && <Field label="Błąd" description={error} />}
      {!installed.length && !error && <Field label="Brak dostępnych dodatków"
        description="Wybierz Odśwież, kiedy Decky zakończy ładowanie wtyczek." />}
    </DialogControlsSection>
  </DialogBody>;
}

type RuntimePlugin = { name: string; content?: ReactNode };
const FEATURE_NAMES: Record<string, string> = {
  "Decky Manager": "Pliki",
  "Decky Terminal": "Decky Terminal (zewnętrzny)"
};
function featureName(name: string): string {
  return FEATURE_NAMES[name] ?? name;
}
type RuntimeLoader = { plugins?: RuntimePlugin[] };

/**
 * Legacy Decky plugin panels are not a stable public embedding API.
 * Only attempt to render them after an explicit button press, so a broken
 * plugin never prevents opening the main SteamHub settings screen.
 */
function loadedPluginContent(name: string): ReactNode | null {
  const loader = (window as Window & { DeckyPluginLoader?: RuntimeLoader }).DeckyPluginLoader;
  if (!Array.isArray(loader?.plugins)) return null;
  return loader.plugins.find(plugin => plugin.name === name)?.content ?? null;
}

class ExternalPanelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.error("[SteamHub] External plugin panel error", error);
  }
  render() {
    return this.state.failed
      ? <Field label="Panel nie działa" description="Otwórz dodatek bezpośrednio w Decky." />
      : this.props.children;
  }
}

function AddonOptions({ name, addon, selected, remove }: {
  name: string;
  addon?: InstalledAddon;
  selected: boolean;
  remove: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [manualPanelOpen, setManualPanelOpen] = useState(false);
  const integrated = name === "Decky Manager";
  const originalContent = loadedPluginContent(name);
  const active = !!addon && !addon.disabled;
  const showPanel = active && !!originalContent && (integrated || manualPanelOpen);

  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>{featureName(name)}</DialogControlsSectionHeader>
      {showPanel
        ? <ExternalPanelBoundary key={name}>
            <div style={{ width: "100%", maxWidth: "100%", minHeight: 240, padding: "8px 0" }}>
              {originalContent}
            </div>
          </ExternalPanelBoundary>
        : <Field label="Panel dodatku jest niedostępny"
            description={!addon ? "Dodatek nie jest zainstalowany. Zainstaluj go w Decky, aby używać go tutaj."
              : addon.disabled ? "Dodatek jest wyłączony w Decky. Włącz go w ustawieniach Decky."
              : integrated ? "Decky nie udostępnia panelu tej wtyczki do osadzenia. Użyj oryginalnego panelu Decky."
              : "Panel można otworzyć poniżej, jeśli Decky udostępnia jego zawartość."} />}
      {!integrated && active && !!originalContent &&
        <Field label="Panel oryginalnej wtyczki">
          <DialogButton onClick={() => setManualPanelOpen(value => !value)}>
            {manualPanelOpen ? "Ukryj panel" : "Pokaż panel"}
          </DialogButton>
        </Field>}
      <Field label="Opcje zaawansowane" description="Stan i konfiguracja integracji">
        <DialogButton onClick={() => setAdvanced(value => !value)}>
          {advanced ? "Zwiń" : "Rozwiń"}
        </DialogButton>
      </Field>
      {advanced && <>
        <Field label="Stan dodatku"
          description={addon?.disabled ? "Wyłączony w Decky" : addon ? "Aktywny w Decky" : "Niezainstalowany"} />
        <Field label="Panel w SteamHub"
          description={originalContent ? "Wykryty panel oryginalnej wtyczki" : "Interfejs nie jest dostępny przez bieżący loader"} />
        <Field label="Widoczny w SteamHub">
          <Toggle value={selected} onChange={value => { if (!value) remove(); }} />
        </Field>
        <Field label="Zarządzanie w Decky" description="Wtyczka zachowuje własne ustawienia oraz aktualizacje.">
          <DialogButton onClick={() => Navigation.Navigate("/decky/settings/plugins")}>
            Otwórz Decky
          </DialogButton>
        </Field>
      </>}
    </DialogControlsSection>
  </DialogBody>;
}

export function HubPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [installed, setInstalled] = useState<InstalledAddon[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const discovered = await listInstalledAddons();
      setInstalled(discovered);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Błąd odczytu dodatków.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getSelection(), listInstalledAddons()]).then(([saved, discovery]) => {
      if (!mounted) return;
      if (saved.status === "fulfilled") setSelected(saved.value);
      else setError("Nie udało się wczytać wybranych dodatków.");
      if (discovery.status === "fulfilled") setInstalled(discovery.value);
      else setError("Nie udało się pobrać listy dodatków z Decky.");
      setBusy(false);
    });
    return () => { mounted = false; };
  }, []);

  async function toggle(name: string, show: boolean) {
    const next = show ? [...selected.filter(x => x !== name), name] : selected.filter(x => x !== name);
    setBusy(true);
    setError("");
    try {
      setSelected(await saveSelection(next));
    } catch {
      setError("Nie udało się zapisać wyboru dodatków.");
    } finally {
      setBusy(false);
    }
  }

  const pages = [
    { title: "Pulpit", route: "/steamhub/home", icon: <FaHome />,
      content: <Overview selected={selected} installed={installed} /> },
    { title: "Dodatki", route: "/steamhub/addons", icon: <FaPuzzlePiece />,
      content: <AddonSelector installed={installed} selected={selected} pending={busy}
        error={error} toggle={toggle} reload={() => { void refresh(); }} /> },
    { title: "Terminal", route: "/steamhub/terminal", icon: <FaTerminal />,
      content: <DeckyTerminalPage /> },
    { title: "Aktualizacje", route: "/steamhub/updates", icon: <FaSyncAlt />,
      content: <UpdaterPage /> },
    { title: "Podziękowania", route: "/steamhub/credits", icon: <FaHeart />,
      content: <CreditsPage /> },
    ...selected.map(name => ({
      title: featureName(name),
      route: "/steamhub/addon/" + encodeURIComponent(name),
      icon: name === "Decky Manager" ? <FaFolderOpen /> : name === "Decky Terminal" ? <FaTerminal /> : <FaPlug />,
      content: <AddonOptions name={name} addon={installed.find(x => x.name === name)}
        selected={selected.includes(name)} remove={() => { void toggle(name, false); }} />
    }))
  ];
  return <SidebarNavigation pages={pages} />;
}

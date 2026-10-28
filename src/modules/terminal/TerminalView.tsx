import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { TerminalBridge } from "./bridge";
import { ensureTerminalStyles } from "./terminalStyles";

function decodeBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

/** Presentation contract, independent of Decky or Steam. */
export interface TerminalLayoutState {
  status: string;
  active: boolean;
  pending: boolean;
  hasSession: boolean;
  command: string;
  advanced: boolean;
  terminalElement: ReactNode;
  start(): void;
  close(): void;
  setCommand(value: string): void;
  submit(): void;
  send(value: string): void;
  toggleAdvanced(): void;
}

/** A Linux desktop frontend can provide its own presentation renderer. */
export function TerminalView({ bridge, render }: {
  bridge: TerminalBridge;
  render?: (state: TerminalLayoutState) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const session = useRef<string | null>(null);
  const mounted = useRef(true);
  const polling = useRef(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Uruchom sesję, aby otworzyć powłokę Linuksa.");
  const [command, setCommand] = useState("");
  const [advanced, setAdvanced] = useState(false);

  function send(value: string) {
    const id = session.current;
    if (!id || !value) return;
    // Preserve order when a terminal sends multiple keystrokes quickly.
    // Individual calls remain below the backend's 4096-byte input limit.
    const bytes = new TextEncoder().encode(value);
    for (let start = 0; start < bytes.length; start += 1024) {
      const part = bytes.subarray(start, start + 1024);
      let binary = "";
      for (const b of part) binary += String.fromCharCode(b);
      const payload = btoa(binary);
      writeQueue.current = writeQueue.current
        .catch(() => undefined)
        .then(async () => { await bridge.write(id, payload); })
        .catch(() => { if (mounted.current) setStatus("Nie udało się wysłać danych do terminala."); });
    }
  }

  useEffect(() => {
    mounted.current = true;
    ensureTerminalStyles();
    const container = host.current;
    if (!container) return;
    const instance = new Terminal({
      convertEol: true, cursorBlink: true, scrollback: 3000,
      fontFamily: "monospace", fontSize: 15, lineHeight: 1.15,
      theme: { background: "#111923", foreground: "#e5edf8", cursor: "#c9d8f2" }
    });
    const addon = new FitAddon();
    instance.loadAddon(addon);
    instance.open(container);
    term.current = instance;
    fit.current = addon;
    try { addon.fit(); } catch { /* Hidden Steam route may not have dimensions yet. */ }
    instance.writeln("SteamOS Hub — niezależny terminal Linux");
    instance.writeln("Sesja uruchomi się tylko po wybraniu przycisku.\r\n");
    const subscription = instance.onData(send);

    const refreshSize = () => {
      try {
        addon.fit();
        const id = session.current;
        if (id && instance.cols > 0 && instance.rows > 0) {
          void bridge.resize(id, instance.cols, instance.rows).catch(() => undefined);
        }
      } catch { /* Not visible yet. */ }
    };
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(refreshSize) : null;
    observer?.observe(container);
    window.addEventListener("resize", refreshSize);

    const timer = window.setInterval(async () => {
      const id = session.current;
      if (!id || polling.current) return;
      polling.current = true;
      try {
        const result = await bridge.read(id);
        if (!mounted.current || id !== session.current) return;
        if (result.data) instance.write(decodeBytes(result.data));
        if (result.truncated) instance.writeln("\r\n[Ostrzeżenie: część wyjścia pominięta]");
        if (!result.running) {
          setActive(false);
          setStatus("Sesja zakończona. Możesz uruchomić kolejną.");
        }
      } catch {
        if (mounted.current && id === session.current) setStatus("Błąd odczytu terminala. Zamknij i uruchom sesję ponownie.");
      } finally {
        polling.current = false;
      }
    }, 170);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener("resize", refreshSize);
      observer?.disconnect();
      subscription.dispose();
      const id = session.current;
      session.current = null;
      if (id) void bridge.close(id).catch(() => undefined);
      instance.dispose();
      term.current = null;
      fit.current = null;
    };
    // The bridge is stable and owned by the host adapter.
  }, [bridge]);

  async function openSession() {
    if (pending) return;
    setPending(true);
    try {
      const old = session.current;
      session.current = null;
      if (old) await bridge.close(old);
      const instance = term.current;
      if (!instance) throw new Error("Terminal nie jest gotowy");
      fit.current?.fit();
      const result = await bridge.start(
        Math.max(20, Math.min(500, instance.cols || 80)),
        Math.max(5, Math.min(200, instance.rows || 24))
      );
      if (!mounted.current) {
        await bridge.close(result.id);
        return;
      }
      instance.clear();
      session.current = result.id;
      setActive(true);
      setStatus("Aktywna sesja użytkownika Linuksa (bez uprawnień root).");
      // Keep controller focus on SteamOS input controls; clicking the xterm
      // pane can still focus it when a physical keyboard is available.
    } catch (error) {
      setActive(false);
      setStatus("Nie udało się uruchomić: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  async function closeSession() {
    const id = session.current;
    session.current = null;
    if (!id) return;
    setActive(false);
    setStatus("Zamykanie sesji…");
    try {
      await bridge.close(id);
      if (mounted.current) setStatus("Sesja zamknięta.");
    } catch {
      if (mounted.current) setStatus("Nie udało się zamknąć sesji.");
    }
  }

  function submitCommand() {
    if (!active || !command.trim()) return;
    send(command + "\r");
    setCommand("");
  }

  // Native SteamOS controls are provided by the Decky adapter, not hardcoded here.
  const state: TerminalLayoutState = {
    status, active, pending, hasSession: session.current !== null,
    command, advanced,
    terminalElement: <div className="steamhub-terminal"
      style={{ width: "100%", height: 400, padding: 10 }}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
    </div>,
    start: () => { void openSession(); },
    close: () => { void closeSession(); },
    setCommand, submit: submitCommand, send,
    toggleAdvanced: () => setAdvanced(value => !value)
  };
  if (render) return <>{render(state)}</>;
  // Browser fallback for a future standalone Linux UI.
  const buttonStyle = { padding: "8px 14px", borderRadius: 5, minHeight: 36 };
  return <section style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
    <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Terminal</h2>
    <div role="status" aria-live="polite" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
      {status}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" style={buttonStyle} disabled={pending || active}
        onClick={() => { void openSession(); }}>
        {pending ? "Czekaj…" : active ? "Aktywny" : "Uruchom sesję"}
      </button>
      <button type="button" style={buttonStyle} disabled={!session.current}
        onClick={() => { void closeSession(); }}>Zamknij</button>
    </div>
    <div className="steamhub-terminal" style={{ width: "100%", height: 400, padding: 10 }}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
    </div>
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.9rem" }}>
      Polecenie (możesz też pisać bezpośrednio w terminalu)
      <span style={{ display: "flex", gap: 8 }}>
        <input aria-label="Polecenie terminala" type="text" value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submitCommand(); }}
          disabled={!active} style={{ flex: 1, minWidth: 0, borderRadius: 4, padding: 8 }} />
        <button type="button" style={buttonStyle} disabled={!active || !command.trim()}
          onClick={submitCommand}>Wyślij</button>
      </span>
    </label>
    <div aria-label="Przyciski terminala" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" style={buttonStyle} disabled={!active}
        onClick={() => send("\u0003")}>Ctrl+C</button>
      <button type="button" style={buttonStyle} disabled={!active}
        onClick={() => send("\t")}>Tab</button>
      <button type="button" style={buttonStyle} disabled={!active}
        onClick={() => send("\r")}>Enter</button>
    </div>
    <div>
      <button type="button" style={buttonStyle} aria-expanded={advanced}
        onClick={() => setAdvanced(value => !value)}>
        Opcje zaawansowane {advanced ? "▲" : "▼"}
      </button>
      {advanced && <p style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
        Terminal działa jako zwykły użytkownik, bez uprawnień root.
        Silnik PTY jest niezależny od Decky i Steam. Maksymalnie trzy sesje;
        bufor wyjścia jest ograniczony do 256 KiB.
      </p>}
    </div>
  </section>;
}

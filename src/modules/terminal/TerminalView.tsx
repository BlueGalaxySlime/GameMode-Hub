import { useEffect, useRef, useState } from "react";
import { appendOutput, clearOutput, getBackendError, getSlot, markBackendUnavailable } from "./sessionStore";
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
  clear(): void;
}

/** A Linux desktop frontend can provide its own presentation renderer. */
export function TerminalView({ bridge, render, fontSize = 15, autoStart = false, visible = true, slotNumber = 0 }: {
  bridge: TerminalBridge;
  render?: (state: TerminalLayoutState) => ReactNode;
  fontSize?: number;
  autoStart?: boolean;
  visible?: boolean;
  slotNumber?: number;
}) {
  const slot = getSlot(slotNumber);
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const session = useRef<string | null>(slot.id);
  const mounted = useRef(true);
  const polling = useRef(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [active, setActive] = useState(slot.phase === "connected");
  const [pending, setPending] = useState(slot.phase === "starting");
  const [status, setStatus] = useState(slot.error || (slot.phase === "connected" ? "Sesja aktywna" : "Przygotowywanie terminala…"));
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
        .then(async () => { await Promise.race([bridge.write(id, payload), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout zapisu")), 3000))]); })
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
      fontFamily: "monospace", fontSize, lineHeight: 1.15,
      theme: { background: "#111923", foreground: "#e5edf8", cursor: "#c9d8f2" }
    });
    const addon = new FitAddon();
    instance.loadAddon(addon);
    instance.open(container);
    term.current = instance;
    fit.current = addon;
    try { addon.fit(); } catch { /* Hidden Steam route may not have dimensions yet. */ }
    if (slot.output) instance.write(slot.output);
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
        if (result.data) {
          const bytes = decodeBytes(result.data);
          appendOutput(slot, new TextDecoder().decode(bytes));
          if (mounted.current) instance.write(bytes);
        }
        if (result.truncated) instance.writeln("\r\n[Ostrzeżenie: część wyjścia pominięta]");
        if (!result.running) {
          slot.phase = "ended";
          slot.error = "Powłoka zakończyła działanie.";
          const finishedId = slot.id;
          slot.id = null;
          session.current = null;
          if (finishedId) void bridge.close(finishedId).catch(() => undefined);
          if (mounted.current) { setActive(false); setStatus(slot.error); }
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
      // Do not close the Linux PTY here: route transitions are not a logout.
      instance.dispose();
      term.current = null;
      fit.current = null;
    };
    // Only mount/unmount owns session lifetime. Font changes must not restart it.
  }, [bridge]);

  useEffect(() => {
    if (!visible) return;
    const instance = term.current;
    if (!instance) return;
    instance.options.fontSize = fontSize;
    try {
      fit.current?.fit();
      const id = session.current;
      if (id) void bridge.resize(id, instance.cols, instance.rows).catch(() => undefined);
    } catch { /* Window may temporarily be hidden by Steam. */ }
  }, [fontSize, visible, bridge]);

  useEffect(() => {
    if (autoStart && visible && slot.phase === "idle" && !getBackendError()) {
      void openSession();
    }
    // Start once when a slot is selected, never on every visit to this page.
  }, [slotNumber, visible, autoStart]);

  async function openSession() {
    if (slot.starting || slot.phase !== "idle" || getBackendError()) return;
    const instance = term.current;
    if (!instance) return;
    slot.starting = true;
    slot.phase = "starting";
    setPending(true);
    setStatus("Sprawdzanie połączenia z backendem…");
    let timedOut = false;

    function bounded<T>(promise: Promise<T>, delay: number): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          timedOut = true;
          reject(new Error("Brak odpowiedzi backendu w czasie " + delay + " ms"));
        }, delay);
        promise.then(value => { window.clearTimeout(timer); resolve(value); },
          error => { window.clearTimeout(timer); reject(error); });
      });
    }

    try {
      // The first probe does not create any process. If it fails, do not call
      // terminal_start and do not expose a retry button that can hang Steam.
      if (bridge.ping) {
        const response = await bounded(bridge.ping(), 2500);
        if (!response.ok) throw new Error("Backend terminala nie jest gotowy");
      }
      if (timedOut) throw new Error("Backend nie odpowiedział");
      setStatus("Uruchamianie sesji…");
      try { fit.current?.fit(); } catch { /* hidden dimensions */ }
      const request = bridge.start(
        Math.max(20, Math.min(500, instance.cols || 80)),
        Math.max(5, Math.min(200, instance.rows || 24))
      );
      // A late reply must not leave an orphaned PTY after a timeout.
      void request.then(result => {
        if (timedOut) void bridge.close(result.id).catch(() => undefined);
      }).catch(() => undefined);
      const result = await bounded(request, 4500);
      if (timedOut) return;
      slot.id = result.id;
      slot.phase = "connected";
      slot.error = "";
      session.current = result.id;
      if (mounted.current) {
        setActive(true);
        setStatus("Sesja aktywna");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = "Terminal nie połączył się z Decky (" + detail +
        "). Wyłączono dalsze próby, aby nie zawieszać SteamOS. " +
        "Po przywróceniu backendu przeładuj SteamHub.";
      markBackendUnavailable(message);
      slot.error = message;
      slot.phase = "unavailable";
      if (mounted.current) {
        setActive(false);
        setStatus(message);
      }
    } finally {
      slot.starting = false;
      if (mounted.current) setPending(false);
    }
  }

  async function closeSession() {
    const id = session.current;
    session.current = null;
    slot.id = null;
    slot.phase = "ended";
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
    status, active, pending, hasSession: slot.id !== null,
    command, advanced,
    terminalElement: <div className="steamhub-terminal"
      style={{ width: "100%", height: "100%", minHeight: 0, overflow: "hidden", padding: 0 }}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
    </div>,
    start: () => { void openSession(); },
    close: () => { void closeSession(); },
    setCommand, submit: submitCommand, send,
    toggleAdvanced: () => setAdvanced(value => !value),
    clear: () => { term.current?.clear(); clearOutput(slot); }
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

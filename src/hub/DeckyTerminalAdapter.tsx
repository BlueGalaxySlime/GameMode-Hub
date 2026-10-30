import { useLayoutEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Focusable, GamepadButton,
  Menu, MenuItem, NavEntryPositionPreferences, showContextMenu
} from "@decky/ui";
import { useHubSessionState } from "./useHubSessionState";
import {
  addTerminalSession, closeTerminalSession, INITIAL_TERMINAL_TABS,
  nextTerminalSession, normalizeTerminalTabs, selectTerminalSession
} from "../modules/terminal/sessionNavigation";
import type { TerminalTabs } from "../modules/terminal/sessionNavigation";
import { TerminalView } from "../modules/terminal/TerminalView";
import type { TerminalBridge } from "../modules/terminal/bridge";
import { clearOutput, getBackendError, getSlot } from "../modules/terminal/sessionStore";
import { HubTextInput } from "./HubTextInput";

const terminalBridge: TerminalBridge = {
  ping: callable<[], { ok: boolean; version: string; protocol: number }>("terminal_ping"),
  start: callable<[number, number], { id: string }>("terminal_start"),
  read: callable<[string], { data: string; running: boolean; truncated: boolean }>("terminal_read"),
  write: callable<[string, string], { ok: boolean }>("terminal_write"),
  resize: callable<[string, number, number], { ok: boolean }>("terminal_resize"),
  close: callable<[string], { ok: boolean }>("terminal_close")
};

/** Native Steam navigation around an independently managed Linux PTY.
 * Nothing spawns a shell until the user presses Uruchom terminal.
 */
export function DeckyTerminalPage({ fontSize }: { fontSize: number }) {
  const [tabState, setTabState] = useHubSessionState<TerminalTabs>(
    "terminal.tabs", INITIAL_TERMINAL_TABS
  );
  const [details, setDetails] = useHubSessionState("terminal.safeDetails", false);
  // Not persisted: an old session preference must never auto-spawn a shell.
  const [activated, setActivated] = useState<number[]>([]);
  const tabs = normalizeTerminalTabs(tabState);
  const active = tabs.selected;
  const sessionsRef = useRef<HTMLDivElement>(null);
  const focusAfterAdd = useRef(false);

  function focusSession(id: number | null = active) {
    if (id === null) {
      sessionsRef.current?.querySelector<HTMLElement>('[data-terminal-add] button')?.focus({ preventScroll: true });
      return;
    }
    sessionsRef.current?.querySelector<HTMLElement>(
      '[data-terminal-session="' + id + '"] button'
    )?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!focusAfterAdd.current) return;
    focusAfterAdd.current = false;
    focusSession(active);
  }, [active, tabs.open.length]);

  function addTab() {
    if (tabs.open.length >= 3) return;
    focusAfterAdd.current = true;
    setTabState(addTerminalSession);
  }

  function closeTab(id: number) {
    const slot = getSlot(id);
    // Don't let a late start response resurrect an already closed tab.
    if (slot.starting) return;
    const sessionId = slot.id;
    slot.id = null;
    slot.phase = "idle";
    slot.error = "";
    clearOutput(slot);
    if (sessionId) void terminalBridge.close(sessionId).catch(() => undefined);
    setActivated(current => current.filter(value => value !== id));
    setTabState(current => closeTerminalSession(current, id));
  }

  function selectTab(id: number) {
    setTabState(current => selectTerminalSession(current, id));
  }

  function switchSession(direction: -1 | 1) {
    setTabState(current => {
      const state = normalizeTerminalTabs(current);
      const next = nextTerminalSession(state.selected, direction, state.open);
      return { ...state, selected: next };
    });
  }

  function openTerminalMenu(parent: EventTarget) {
    showContextMenu(
      <Menu label="Opcje terminala">
        <MenuItem disabled={tabs.open.length >= 3} onSelected={addTab}>
          Nowa sesja
        </MenuItem>
        {tabs.open.map(id =>
          <MenuItem key={id} selected={active === id}
            onSelected={() => selectTab(id)}>
            {"Sesja " + (id + 1)}
          </MenuItem>)}
        <MenuItem disabled={active === null || (active !== null && getSlot(active).starting)}
          onSelected={() => { if (active !== null) closeTab(active); }}>
          Zamknij bieżącą sesję
        </MenuItem>
        <MenuItem onSelected={() => setDetails(previous => !previous)}>
          {details ? "Ukryj informacje" : "Informacje o terminalu"}
        </MenuItem>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  // SteamOS can swallow physical LB/RB before the plugin sees them. The
  // visible tabs and native Y menu remain available as fallbacks.
  function handleShoulderButton(button: GamepadButton): boolean {
    const values = GamepadButton as unknown as Record<string, number>;
    const left = [values.LB, values.L1, values.LBUMPER, values.LEFT_BUMPER];
    const right = [values.RB, values.R1, values.RBUMPER, values.RIGHT_BUMPER];
    if (left.some(code => code !== undefined && code === button)) {
      switchSession(-1);
      return true;
    }
    if (right.some(code => code !== undefined && code === button)) {
      switchSession(1);
      return true;
    }
    return false;
  }

  return <DialogBody>
    <DialogControlsSection>
      <Focusable flow-children="column"
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0 }}
        onOptionsActionDescription="Opcje terminala"
        onOptionsButton={event => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          openTerminalMenu(event.currentTarget ?? window);
        }}
        onSecondaryActionDescription="Zakładki sesji"
        onSecondaryButton={event => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          focusSession();
        }}
        onButtonDown={event => {
          if (event.defaultPrevented || !handleShoulderButton(event.detail.button)) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={event => {
          if (event.key === "PageUp" || event.key === "PageDown") {
            event.preventDefault();
            event.stopPropagation();
            switchSession(event.key === "PageUp" ? -1 : 1);
          }
        }}
        onContextMenu={event => {
          event.preventDefault();
          openTerminalMenu(event.currentTarget);
        }}>
        <div aria-label="Stan terminala" role="status"
          style={{ display: "flex", alignItems: "center", flexWrap: "wrap",
            gap: 14, minHeight: 23, fontSize: 12, opacity: 0.78 }}>
          <span>Sesje: {tabs.open.length}/3</span>
          <strong>Terminal uruchamiany wyłącznie na żądanie</strong>
        </div>

        <Focusable flow-children="row" ref={sessionsRef}
          aria-label="Sesje terminala — LB i RB"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap",
            alignItems: "stretch", gap: 5, width: "100%", minWidth: 0,
            overflowX: "auto", overflowY: "hidden" }}>
          {tabs.open.map(id =>
            <div key={id} data-terminal-session={id}
              style={{ display: "flex", alignItems: "stretch", minWidth: 0, flex: "0 0 auto" }}>
              <DialogButton preferredFocus={active === id}
                aria-label={"Sesja " + (id + 1)}
                onOKActionDescription="Wybierz sesję"
                onSecondaryActionDescription="Zakładki sesji"
                onSecondaryButton={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  focusSession();
                }}
                onOptionsActionDescription="Opcje terminala"
                onOptionsButton={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  openTerminalMenu(event.currentTarget ?? window);
                }}
                onClick={() => selectTab(id)}
                style={{ minWidth: 55, padding: "7px 10px", textAlign: "center",
                  borderRadius: 0, fontWeight: active === id ? 700 : 400,
                  borderBottom: active === id ? "2px solid currentColor" : "2px solid transparent" }}>
                {id + 1}
              </DialogButton>
              <DialogButton disabled={getSlot(id).starting}
                aria-label={"Zamknij zakładkę " + (id + 1)}
                onOKActionDescription="Zamknij zakładkę"
                onOptionsActionDescription="Opcje terminala"
                onOptionsButton={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  openTerminalMenu(event.currentTarget ?? window);
                }}
                onSecondaryButton={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  focusSession();
                }}
                onClick={() => closeTab(id)}
                style={{ minWidth: 34, padding: "7px 7px", borderRadius: 0 }}>
                ×
              </DialogButton>
            </div>)}
          <div data-terminal-add style={{ flex: "0 0 auto" }}>
            <DialogButton disabled={tabs.open.length >= 3}
              aria-label="Dodaj sesję"
              onOKActionDescription="Dodaj sesję"
              onOptionsActionDescription="Opcje terminala"
              onOptionsButton={event => {
                event.preventDefault();
                event.stopPropagation();
                openTerminalMenu(event.currentTarget ?? window);
              }}
              onClick={addTab}
              style={{ minWidth: 42, padding: "7px 10px", borderRadius: 0 }}>
              +
            </DialogButton>
          </div>
        </Focusable>

        {active === null ? <div role="region" aria-label="Terminal — brak sesji"
          style={{ minHeight: 160, padding: 12 }}>
          Brak sesji. Wybierz +, aby dodać zakładkę.
        </div> : (activated.includes(active) ||
          getSlot(active).phase === "connected" || getSlot(active).phase === "starting") ?
          <TerminalView key={active} bridge={terminalBridge} slotNumber={active}
            fontSize={fontSize} autoStart visible render={terminal => <>
            <div role="status" aria-label="Status powłoki"
              style={{ fontSize: 12, opacity: 0.9, overflowWrap: "anywhere" }}>
              {terminal.status}
            </div>
            <div role="region" aria-label={"Terminal — sesja " + (active + 1)}
              style={{ boxSizing: "border-box", width: "100%", minWidth: 0,
                height: "min(54vh, 540px)", minHeight: 160, overflow: "hidden",
                background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.13)",
                padding: "8px", fontFamily: "monospace" }}>
              {terminal.terminalElement}
            </div>
            <Focusable flow-children="row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <DialogButton disabled={terminal.pending || terminal.active || !!getBackendError()}
                onClick={terminal.start}>Uruchom terminal</DialogButton>
              <DialogButton disabled={!terminal.hasSession}
                onClick={() => {
                  terminal.close();
                  setActivated(current => current.filter(id => id !== active));
                }}>Zamknij powłokę</DialogButton>
              <DialogButton disabled={!terminal.active} onClick={terminal.focus}>
                Klawiatura fizyczna
              </DialogButton>
              <DialogButton disabled={!terminal.active} onClick={() => terminal.send("\u0003")}>
                Ctrl+C
              </DialogButton>
              <DialogButton disabled={!terminal.active} onClick={() => terminal.send("\t")}>
                Tab
              </DialogButton>
              <DialogButton disabled={!terminal.active} onClick={() => terminal.send("\r")}>
                Enter
              </DialogButton>
              <DialogButton onClick={terminal.clear}>Wyczyść ekran</DialogButton>
            </Focusable>
            <Focusable flow-children="row" style={{ display: "flex", alignItems: "center",
              gap: 6, width: "100%" }}>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <HubTextInput aria-label="Polecenie terminala" placeholder="Wpisz polecenie"
                  disabled={!terminal.active} value={terminal.command}
                  onChange={event => terminal.setCommand(event.currentTarget.value)}
                  onEditValue={terminal.setCommand}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      terminal.submit();
                    }
                  }} />
              </div>
              <DialogButton disabled={!terminal.active || !terminal.command.trim()}
                onClick={terminal.submit}>Wyślij</DialogButton>
            </Focusable>
          </>} /> :
          <div role="region" aria-label={"Terminal — sesja " + (active + 1)}
            style={{ boxSizing: "border-box", width: "100%", minWidth: 0,
              height: "min(54vh, 540px)", minHeight: 160, background: "rgba(0,0,0,0.28)",
              border: "1px solid rgba(255,255,255,0.13)", padding: 12 }}>
            <div style={{ marginBottom: 12 }}>Sesja {active + 1} — nieuruchomiona.</div>
            {getBackendError() && <div role="status">{getBackendError()}</div>}
            <DialogButton disabled={!!getBackendError()}
              onClick={() => setActivated(current => [...current, active])}>
              Uruchom terminal
            </DialogButton>
          </div>}
        {details && <div role="status"
          style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.5, padding: "3px 1px" }}>
          Zakładki nie uruchamiają procesów automatycznie. Powłoka działa
          jako zwykły użytkownik bez root, maksymalnie 3 sesje.
          Wyjście terminala jest limitowane i odczytywane poza główną pętlą Decky.
        </div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

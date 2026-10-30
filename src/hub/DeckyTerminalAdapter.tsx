import { useRef } from "react";
import {
  DialogBody, DialogButton, DialogControlsSection, Focusable, GamepadButton,
  Menu, MenuGroup, MenuItem, NavEntryPositionPreferences, showContextMenu
} from "@decky/ui";
import { useHubSessionState } from "./useHubSessionState";
import { nextTerminalSession, TERMINAL_SESSIONS } from "../modules/terminal/sessionNavigation";

/**
 * Steam Gaming Mode terminal shell: share the layout and gamepad controls of
 * Files/Desktop, without mounting xterm or making terminal RPC requests.
 *
 * A prior handheld test ended in a Steam UI restart. The cause is unconfirmed,
 * so the separate PTY engine must remain disabled until it is investigated.
 */
export function DeckyTerminalPage({ fontSize }: { fontSize: number }) {
  const [selected, setSelected] = useHubSessionState("terminal.selected", 0);
  const [details, setDetails] = useHubSessionState("terminal.safeDetails", false);
  const sessionsRef = useRef<HTMLDivElement>(null);
  const active = TERMINAL_SESSIONS.includes(selected as 0 | 1 | 2) ? selected : 0;

  function focusSession() {
    const buttons = sessionsRef.current?.querySelectorAll<HTMLElement>('button, [role="button"]');
    (buttons?.[active] ?? buttons?.[0])?.focus({ preventScroll: true });
  }

  function openTerminalMenu(parent: EventTarget) {
    showContextMenu(
      <Menu label="Opcje terminala">
        <MenuGroup label="Sesje">
          {TERMINAL_SESSIONS.map(number =>
            <MenuItem key={number} selected={active === number}
              onSelected={() => setSelected(number)}>
              Sesja {number + 1}
            </MenuItem>)}
        </MenuGroup>
        <MenuItem onSelected={() => setDetails(previous => !previous)}>
          {details ? "Ukryj informacje" : "Informacje o terminalu"}
        </MenuItem>
      </Menu>,
      parent,
      { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  function switchSession(direction: -1 | 1) {
    setSelected(next => nextTerminalSession(next, direction));
  }

  // SteamOS uses named shoulder buttons across different controller layouts.
  // Do not trap other buttons or Steam's native Back action.
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
        style={{ display: "flex", flexDirection: "column", gap: 9,
          width: "100%", minWidth: 0 }}
        onOptionsActionDescription="Opcje terminala"
        onOptionsButton={event => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          openTerminalMenu(event.currentTarget ?? window);
        }}
        onSecondaryActionDescription="Wybierz sesję"
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
          // Keyboard equivalent of LB/RB for testing without a controller.
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
          <span>Terminal</span>
          <span>Sesja: {active + 1}/3</span>
          <strong>Tryb bezpieczny — wyłączony</strong>
        </div>

        <Focusable flow-children="row" ref={sessionsRef}
          aria-label="Sesje terminala — LB i RB"
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{ display: "flex", flexDirection: "row", gap: 5,
            width: "100%", minWidth: 0 }}>
          {TERMINAL_SESSIONS.map(number => <DialogButton key={number}
            preferredFocus={active === number}
            aria-label={"Sesja " + (number + 1)}
            onOKActionDescription="Wybierz sesję"
            onSecondaryActionDescription="Wybierz sesję"
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
            onClick={() => setSelected(number)}
            style={{ flex: "1 1 0", minWidth: 0, textAlign: "center",
              padding: "7px 10px", fontWeight: active === number ? 700 : 400,
              borderRadius: 0,
              borderBottom: active === number ? "2px solid currentColor" : "2px solid transparent" }}>
            {number + 1}
          </DialogButton>)}
        </Focusable>

        <div role="region" aria-label={"Terminal — sesja " + (active + 1)}
          style={{ boxSizing: "border-box", width: "100%", minWidth: 0,
            height: "min(49vh, 480px)", minHeight: 200, overflowY: "auto",
            background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.13)",
            padding: "12px 13px", fontFamily: "monospace",
            fontSize: Math.max(11, Math.min(22, fontSize)),
            lineHeight: 1.4, overflowWrap: "anywhere" }}>
          <div style={{ opacity: 0.85 }}>
            Sesja {active + 1} — nieuruchomiona.
          </div>
          <div style={{ marginTop: 8, opacity: 0.72 }}>
            Wykonywanie poleceń jest zablokowane do czasu wyjaśnienia wcześniejszego
            restartu interfejsu Steam.
          </div>
        </div>

        {details && <div role="status"
          style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.5, padding: "3px 1px" }}>
          Silnik PTY pozostaje wyłączony również w backendzie. W tym widoku
          nie uruchamiamy powłoki, nie wysyłamy poleceń i nie odczytujemy
          poświadczeń. Przyczyna wcześniejszej awarii nie jest potwierdzona.
        </div>}
      </Focusable>
    </DialogControlsSection>
  </DialogBody>;
}

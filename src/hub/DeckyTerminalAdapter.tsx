import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Field,
  Focusable, GamepadButton, NavEntryPositionPreferences, SliderField, TextField
} from "@decky/ui";
import { FaChevronLeft, FaChevronRight, FaCompress, FaExpand, FaKeyboard, FaPlus } from "react-icons/fa";
import { TerminalView } from "../modules/terminal/TerminalView";
import type { TerminalLayoutState } from "../modules/terminal/TerminalView";
import type { TerminalBridge, TerminalRead } from "../modules/terminal/bridge";

/** Steam/Decky-specific presentation and RPC adapter.
 * The terminal emulator and PTY core do not import Steam or Decky.
 */
const start = callable<[number, number], { id: string }>("terminal_start");
const read = callable<[string], TerminalRead>("terminal_read");
const write = callable<[string, string], { ok: boolean }>("terminal_write");
const resize = callable<[string, number, number], { ok: boolean }>("terminal_resize");
const close = callable<[string], { ok: boolean }>("terminal_close");
const ping = callable<[], { ok: boolean }>("terminal_ping");
const bridge: TerminalBridge = { start, read, write, resize, close, ping };

/**
 * Steam's native keyboard: use an offscreen Decky TextField as the input
 * target, mirroring the documented project behavior of Decky Terminal.
 * Its underlying Steam input element is clicked from a real button gesture.
 * It must NOT be disabled, or Steam will refuse to open its keyboard.
 */
function SteamKeyboard({ state, buttonStyle }: {
  state: TerminalLayoutState;
  buttonStyle: React.CSSProperties;
}) {
  const inputRef = useRef<any>(null);
  // Decky TextField forwards a private native-input ref, as used by Decky Terminal.
  const NativeTextField = TextField as any;
  const valueRef = useRef("");
  const [inputValue, setInputValue] = useState("");
  const open = () => {
    const native = inputRef.current?.m_elInput as HTMLInputElement | undefined;
    if (native) {
      native.click();
      native.focus();
    } else {
      // Some Decky UI versions expose the underlying input as a different ref.
      const element = document.getElementById("steamhub-steam-keyboard") as HTMLInputElement | null;
      element?.click();
      element?.focus();
    }
  };
  const changed = (next: string) => {
    const previous = valueRef.current;
    valueRef.current = next;
    if (!state.active) return;
    if (next.startsWith(previous)) {
      const entered = next.slice(previous.length);
      if (entered) state.send(entered);
    } else if (previous.startsWith(next)) {
      state.send("\u007f".repeat(Array.from(previous).length - Array.from(next).length));
    } else {
      // Steam's modal keyboard may replace the entire input on confirmation.
      if (next) state.send(next);
    }
  };
  return <>
    <NativeTextField ref={inputRef} id="steamhub-steam-keyboard"
      style={{ display: "none" }}
      value={inputValue}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setInputValue(event.target.value); changed(event.target.value); }}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (state.active) state.send("\r");
        }
      }} />
    <DialogButton style={buttonStyle} aria-label="Otwórz klawiaturę systemową SteamOS"
      onClick={open}><FaKeyboard /></DialogButton>
  </>;
}

function SessionPane({
  state, number, count, selected, fullScreen, canAdd,
  add, previous, next, toggleFullscreen
}: {
  state: TerminalLayoutState;
  number: number;
  count: number;
  selected: boolean;
  fullScreen: boolean;
  canAdd: boolean;
  add(): void;
  previous(): void;
  next(): void;
  toggleFullscreen(): void;
}) {
  const smallButton = { minWidth: "2.15rem", width: "2.15rem", height: "2.05rem", padding: "2px 5px", flexShrink: 0 };
  const failed = !state.active && !state.pending;
  const toolbar = <div style={{
    position: fullScreen ? "fixed" : "relative",
    zIndex: fullScreen ? 999999 : "auto",
    top: fullScreen ? "42px" : undefined,
    left: fullScreen ? 0 : undefined,
    right: fullScreen ? 0 : undefined,
    bottom: fullScreen ? "36px" : undefined,
    boxSizing: "border-box",
    display: selected ? "flex" : "none",
    flexDirection: "column",
    width: "100%", height: fullScreen ? "auto" : "calc(100dvh - 145px)",
    minHeight: 0, maxHeight: "100%",
    background: "#111923", overflow: "hidden",
    padding: fullScreen ? "4px 12px 8px" : "0 8px 6px"
  }}>
    <Focusable flow-children="right" navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
      style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0,
        padding: "4px 0", minHeight: 40, width: "100%" }}>
      <DialogButton style={smallButton} aria-label="Poprzednia sesja (LB)"
        onClick={previous}><FaChevronLeft /></DialogButton>
      <div style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden",
        textOverflow: "ellipsis", fontSize: "1.05rem", fontWeight: 600 }}>
        Terminal {number}
      </div>
      <DialogButton style={smallButton} aria-label="Dodaj sesję terminala"
        disabled={!canAdd} onClick={add}><FaPlus /></DialogButton>
      <DialogButton style={smallButton} aria-label="Następna sesja (RB)"
        onClick={next}><FaChevronRight /></DialogButton>
      <SteamKeyboard state={state} buttonStyle={smallButton} />
      <DialogButton style={smallButton} aria-label={fullScreen ? "Zamknij pełny ekran" : "Pełny ekran"}
        onClick={toggleFullscreen}>{fullScreen ? <FaCompress /> : <FaExpand />}</DialogButton>
    </Focusable>
    <div role="status" aria-live="polite" style={{
      display: state.active ? "none" : "block", fontSize: "0.77rem",
      flexShrink: 0, padding: "3px 4px", overflowWrap: "anywhere"
    }}>
      {state.status}
      {failed && <DialogButton onClick={state.start}>Ponów</DialogButton>}
    </div>
    <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", width: "100%" }}>
      {state.terminalElement}
    </div>
  </div>;
  // Render the fullscreen pane at the document root, outside the clipped
  // Steam SidebarNavigation subtree. The existing xterm DOM is reattached
  // by TerminalView when the host changes; PTY sessions stay alive.
  return fullScreen && selected ? createPortal(toolbar, document.body) : toolbar;
}

export function DeckyTerminalPage({ fontSize }: { fontSize: number }) {
  const [sessions, setSessions] = useState<number[]>([1]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const nextNumber = useRef(2);

  const previous = () => setSelectedIndex(index => (index + sessions.length - 1) % sessions.length);
  const next = () => setSelectedIndex(index => (index + 1) % sessions.length);
  const add = () => {
    if (sessions.length >= 3) return;
    setSessions(previous => [...previous, nextNumber.current++]);
    setSelectedIndex(sessions.length);
  };
  const onGamepad = (event: { detail: { button: GamepadButton }; preventDefault(): void }) => {
    if (event.detail.button === GamepadButton.BUMPER_LEFT && sessions.length > 1) {
      event.preventDefault();
      previous();
    } else if (event.detail.button === GamepadButton.BUMPER_RIGHT && sessions.length > 1) {
      event.preventDefault();
      next();
    }
  };

  return <Focusable flow-children="right" onButtonDown={onGamepad}
    style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
    {sessions.map((number, index) => <div key={number}
      style={{ display: index === selectedIndex ? "block" : "none", width: "100%" }}>
      <TerminalView bridge={bridge} fontSize={fontSize}
        visible={index === selectedIndex} fullScreen={fullScreen} autoStart
        render={state => <SessionPane
          state={state} number={number} count={sessions.length}
          selected={index === selectedIndex} fullScreen={fullScreen}
          canAdd={sessions.length < 3} add={add} previous={previous} next={next}
          toggleFullscreen={() => setFullScreen(value => !value)} />} />
    </div>)}
  </Focusable>;
}

export function TerminalOptionsPage({ fontSize, setFontSize }: {
  fontSize: number;
  setFontSize(value: number): void;
}) {
  return <DialogBody>
    <DialogControlsSection>
      <Field label="Rozmiar czcionki" description="Wielkość czcionki terminala.">
        <SliderField min={11} max={22} step={1} showValue
          value={fontSize} onChange={setFontSize} />
      </Field>
      <Field label="Klawiatura"
        description="Przycisk z ikoną klawiatury otwiera systemową klawiaturę SteamOS, zamiast dodatkowych przycisków w Hubie." />
      <Field label="Sesje"
        description="W prawym panelu można uruchomić do 3 niezależnych terminali. LB i RB przełączają aktywną sesję." />
      <Field label="Pełny ekran"
        description="Ikona obok klawiatury rozszerza terminal na cały ekran i pozwala wrócić do Huba." />
    </DialogControlsSection>
  </DialogBody>;
}

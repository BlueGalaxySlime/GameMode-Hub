import { useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Field,
  Focusable, GamepadButton, SliderField, TextField
} from "@decky/ui";
import { FaCompress, FaExpand, FaKeyboard, FaPlus } from "react-icons/fa";
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
  const valueRef = useRef("");
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
    <TextField ref={inputRef} id="steamhub-steam-keyboard"
      style={{ position: "absolute", width: "1px", height: "1px",
        opacity: 0, pointerEvents: "none", left: "-9999px" }}
      value={valueRef.current}
      onChange={event => changed(event.target.value)}
      onKeyDown={event => {
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
  state, number, index, count, selected, fullScreen, canAdd,
  add, previous, next, toggleFullscreen
}: {
  state: TerminalLayoutState;
  number: number;
  index: number;
  count: number;
  selected: boolean;
  fullScreen: boolean;
  canAdd: boolean;
  add(): void;
  previous(): void;
  next(): void;
  toggleFullscreen(): void;
}) {
  const smallButton = { minWidth: "2.5rem", height: "2.2rem", padding: "3px 6px" };
  const failed = !state.active && !state.pending;
  return <div style={{
    position: fullScreen ? "fixed" : "sticky",
    zIndex: fullScreen ? 999999 : 10,
    inset: fullScreen ? 0 : undefined,
    top: 0,
    boxSizing: "border-box",
    display: selected ? "flex" : "none",
    flexDirection: "column",
    width: "100%",
    height: fullScreen ? "100dvh" : "calc(100dvh - 110px)",
    maxHeight: fullScreen ? "100dvh" : undefined,
    minHeight: 0,
    background: "#111923",
    overflow: "hidden",
    padding: fullScreen ? "12px 16px" : "0 8px 6px"
  }}>
    <div style={{
      display: "flex", gap: 6, alignItems: "center",
      flexShrink: 0, padding: "5px 0", minHeight: 40
    }}>
      <DialogButton style={smallButton} aria-label="Poprzednia sesja, LB"
        disabled={count < 2} onClick={previous}>LB</DialogButton>
      <div style={{
        flex: 1, whiteSpace: "nowrap", overflow: "hidden",
        textOverflow: "ellipsis", fontSize: "1.05rem", fontWeight: 600
      }}>Terminal {number}</div>
      <DialogButton style={smallButton} aria-label="Dodaj sesję terminala"
        disabled={!canAdd} onClick={add}><FaPlus /></DialogButton>
      <DialogButton style={smallButton} aria-label="Następna sesja, RB"
        disabled={count < 2} onClick={next}>RB</DialogButton>
      <SteamKeyboard state={state} buttonStyle={smallButton} />
      <DialogButton style={smallButton} aria-label={fullScreen ? "Wyłącz pełny ekran" : "Pełny ekran"}
        onClick={toggleFullscreen}>{fullScreen ? <FaCompress /> : <FaExpand />}</DialogButton>
    </div>
    {(!state.active) && <div role="status" aria-live="polite"
      style={{ fontSize: "0.77rem", flexShrink: 0, padding: "3px 4px", overflowWrap: "anywhere" }}>
      {state.status}
      {failed && <DialogButton onClick={state.start}>Ponów</DialogButton>}
    </div>}
    <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", width: "100%" }}>
      {state.terminalElement}
    </div>
  </div>;
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

  return <Focusable noFocusRing onButtonDown={onGamepad}
    style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
    {sessions.map((number, index) => <div key={number}
      style={{ display: index === selectedIndex ? "block" : "none", width: "100%" }}>
      <TerminalView bridge={bridge} fontSize={fontSize}
        visible={index === selectedIndex} autoStart
        render={state => <SessionPane
          state={state} number={number} index={index} count={sessions.length}
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

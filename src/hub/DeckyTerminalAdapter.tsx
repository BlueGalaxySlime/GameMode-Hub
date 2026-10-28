import { useRef, useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Field,
  Focusable, GamepadButton, NavEntryPositionPreferences, SliderField, TextField
} from "@decky/ui";
import { FaEraser, FaKeyboard } from "react-icons/fa";
import { TerminalView } from "../modules/terminal/TerminalView";
import type { TerminalLayoutState } from "../modules/terminal/TerminalView";
import type { TerminalBridge, TerminalRead } from "../modules/terminal/bridge";
import { getSelectedSlot, selectSlot } from "../modules/terminal/sessionStore";

/** Steam/Decky-specific presentation and RPC adapter.
 * The terminal emulator and PTY core do not import Steam or Decky.
 */
const start = callable<[number, number], { id: string }>("terminal_start");
const read = callable<[string], TerminalRead>("terminal_read");
const write = callable<[string, string], { ok: boolean }>("terminal_write");
const resize = callable<[string, number, number], { ok: boolean }>("terminal_resize");
const close = callable<[string], { ok: boolean }>("terminal_close");
const ping = callable<[], { ok: boolean; version?: string; protocol?: number }>("terminal_ping");
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

function SessionPane({ state, activeSlot, choose }: {
  state: TerminalLayoutState;
  activeSlot: number;
  choose(index: number): void;
}) {
  const iconStyle = { minWidth: "2.15rem", width: "2.15rem", height: "2.05rem",
    padding: "2px 5px", flexShrink: 0 };
  return <div style={{
    width: "100%", height: "calc(100dvh - 145px)", maxHeight: "calc(100dvh - 145px)",
    minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column",
    overflow: "hidden", background: "#111923", padding: "0 7px 6px"
  }}>
    <Focusable flow-children="right" navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
      style={{ display: "flex", gap: 5, alignItems: "center", width: "100%",
        flexShrink: 0, height: 41 }}>
      <div style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>Terminal</div>
      {[0, 1, 2].map(index => (
        <DialogButton key={index} style={{
          ...iconStyle, background: activeSlot === index ? "#426b99" : undefined
        }} aria-label={"Terminal " + (index + 1)}
          onClick={() => choose(index)}>{index + 1}</DialogButton>
      ))}
      <SteamKeyboard state={state} buttonStyle={iconStyle} />
      <DialogButton style={iconStyle} aria-label="Wyczyść ekran terminala"
        onClick={state.clear}><FaEraser /></DialogButton>
    </Focusable>
    {(!state.active) && <div role="status" aria-live="polite" style={{
      fontSize: "0.78rem", padding: "3px 5px", flexShrink: 0,
      overflowWrap: "anywhere", maxHeight: "5rem", overflowY: "auto"
    }}>
      {state.status}
    </div>}
    <div style={{ flex: "1 1 0", minHeight: 0, width: "100%", overflow: "hidden" }}>
      {state.terminalElement}
    </div>
  </div>;
}

export function DeckyTerminalPage({ fontSize }: { fontSize: number }) {
  // Selected session survives navigating to another Hub page.
  const [selectedIndex, setSelectedIndex] = useState(getSelectedSlot);
  const choose = (index: number) => {
    selectSlot(index);
    setSelectedIndex(index);
  };
  const previous = () => choose((selectedIndex + 2) % 3);
  const next = () => choose((selectedIndex + 1) % 3);
  const onGamepad = (event: { detail: { button: GamepadButton }; preventDefault(): void }) => {
    if (event.detail.button === GamepadButton.BUMPER_LEFT) {
      event.preventDefault();
      previous();
    } else if (event.detail.button === GamepadButton.BUMPER_RIGHT) {
      event.preventDefault();
      next();
    }
  };
  return <Focusable flow-children="right"
    navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
    onButtonDown={onGamepad}
    style={{ width: "100%", height: "100%", overflow: "hidden" }}>
    <TerminalView key={selectedIndex} bridge={bridge} slotNumber={selectedIndex}
      fontSize={fontSize} autoStart
      render={state => <SessionPane state={state}
        activeSlot={selectedIndex} choose={choose} />} />
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
        description="Trzy stałe sesje 1, 2, 3. Wybór sesji lub LB/RB przełącza między nimi. Sesje są zachowywane po opuszczeniu sekcji Terminal." />
      <Field label="Wyczyść ekran"
        description="Ikona gumki usuwa tekst z widoku, ale nie kończy powłoki. Sesje zostają zamknięte dopiero po wyładowaniu SteamHub." />
      <Field label="Połączenie"
        description="Jeśli backend Decky nie odpowiada, SteamHub wyłącza dalsze próby automatycznego łączenia, żeby nie zawieszać Gaming Mode." />
    </DialogControlsSection>
  </DialogBody>;
}

import { useState } from "react";
import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection, Field, SliderField, TextField, ToggleField
} from "@decky/ui";
import { TerminalView } from "../modules/terminal/TerminalView";
import { TerminalKeyboard } from "./TerminalKeyboard";
import type { TerminalLayoutState } from "../modules/terminal/TerminalView";
import type { TerminalBridge, TerminalRead } from "../modules/terminal/bridge";

/** Only this adapter uses Decky. The PTY and terminal view are portable. */
const start = callable<[number, number], { id: string }>("terminal_start");
const read = callable<[string], TerminalRead>("terminal_read");
const write = callable<[string, string], { ok: boolean }>("terminal_write");
const resize = callable<[string, number, number], { ok: boolean }>("terminal_resize");
const close = callable<[string], { ok: boolean }>("terminal_close");
const bridge: TerminalBridge = { start, read, write, resize, close };

export type TerminalPreferences = {
  fontSize: number;
  showExtraKeys: boolean;
};
export type TerminalPreferencesChange = {
  setFontSize(value: number): void;
  setShowExtraKeys(value: boolean): void;
};

/** The entire right-hand area is allocated to terminal output; it does not
 * grow with output lines or with keyboard buttons. xterm has its own scrollbar.
 */
function SteamTerminalLayout({ state, showExtraKeys, keyboardOpen, toggleKeyboard }: {
  state: TerminalLayoutState;
  showExtraKeys: boolean;
  keyboardOpen: boolean;
  toggleKeyboard(): void;
}) {
  return <div style={{
    boxSizing: "border-box", width: "100%", height: "calc(100vh - 205px)",
    maxHeight: "640px", minHeight: "250px", overflow: "hidden",
    display: "flex", flexDirection: "column", gap: 6, padding: "4px 12px 8px"
  }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
      <DialogButton disabled={state.pending || state.active} onClick={state.start}>
        {state.pending ? "Czekaj…" : state.active ? "Uruchomiony" : "Uruchom"}
      </DialogButton>
      <DialogButton disabled={!state.hasSession} onClick={state.close}>Zamknij</DialogButton>
      <DialogButton onClick={toggleKeyboard}>
        {keyboardOpen ? "Ukryj klawiaturę" : "Pokaż klawiaturę"}
      </DialogButton>
    </div>
    <div role="status" aria-live="polite" style={{
      fontSize: "0.78rem", lineHeight: "1.15rem", opacity: 0.85,
      maxHeight: "2.3rem", minHeight: "1.15rem", overflow: "hidden", flexShrink: 0
    }}>{state.status}</div>
    <div style={{ flex: "1 1 0", minHeight: 65, width: "100%", overflow: "hidden" }}>
      {state.terminalElement}
    </div>
    {keyboardOpen && <div style={{
      flex: "0 1 260px", minHeight: 160, maxHeight: "48%",
      overflowY: "auto", overflowX: "hidden",
      background: "rgba(28,37,51,0.98)", borderRadius: 5,
      padding: "5px 6px", boxSizing: "border-box"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField value={state.command}
            placeholder="Wpisz polecenie"
            onChange={event => state.setCommand(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && state.active) state.submit(); }} />
        </div>
        <DialogButton disabled={!state.active || !state.command.trim()} onClick={state.submit}>Wyślij</DialogButton>
      </div>
      <TerminalKeyboard state={state} showExtraKeys={showExtraKeys} />
    </div>}
  </div>;
}

export function DeckyTerminalPage({ fontSize, showExtraKeys }: TerminalPreferences) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  return <TerminalView bridge={bridge} fontSize={fontSize}
    render={state => <SteamTerminalLayout
      state={state} showExtraKeys={showExtraKeys}
      keyboardOpen={keyboardOpen}
      toggleKeyboard={() => setKeyboardOpen(open => !open)} />} />;
}

/** Accessible from the left sidebar, separated from the terminal workspace. */
export function TerminalOptionsPage({
  fontSize, showExtraKeys, setFontSize, setShowExtraKeys
}: TerminalPreferences & TerminalPreferencesChange) {
  return <DialogBody>
    <DialogControlsSection>
      <Field label="Rozmiar czcionki" description="Wielkość liter wyświetlanych przez terminal.">
        <SliderField min={11} max={22} step={1} value={fontSize}
          showValue onChange={setFontSize} />
      </Field>
      <Field label="Klawisze dodatkowe" description="Ctrl+C, Tab i Enter na klawiaturze ekranowej.">
        <ToggleField checked={showExtraKeys} onChange={setShowExtraKeys} />
      </Field>
      <Field label="Klawiatura ekranowa"
        description="Przycisk Pokaż klawiaturę znajduje się zawsze nad terminalem. Wpisywanie jest dostępne również przed uruchomieniem sesji." />
      <Field label="Sesja"
        description="Uruchamiana na żądanie jako zwykły użytkownik Linuksa. Brak uprawnień root; maksymalnie trzy sesje." />
      <Field label="Przewijanie"
        description="Przewija się tylko zawartość terminala. Jego okno pozostaje w górnej części ekranu." />
    </DialogControlsSection>
  </DialogBody>;
}

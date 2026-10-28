import { useState } from "react";
import { DialogButton, Field } from "@decky/ui";
import type { TerminalLayoutState } from "../modules/terminal/TerminalView";

/**
 * Controller-friendly on-screen keyboard for SteamOS Gaming Mode.
 * Uses native Decky/Steam UI focusable buttons. The global Steam keyboard
 * may not be available inside a custom route: this keyboard needs no global
 * Steam keyboard hooks and does not send commands until submitted.
 */
const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const SYMBOLS = ["/", "-", "_", "~", ".", ":", "=", "|", "&", "\\", "'", '"', "$", "*", "+", "?", "!", "@", "#", "%"];

export function TerminalKeyboard({ state }: { state: TerminalLayoutState }) {
  const [expanded, setExpanded] = useState(true);
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const add = (key: string) => state.setCommand(state.command + (shift ? key.toUpperCase() : key));
  const erase = () => state.setCommand(Array.from(state.command).slice(0, -1).join(""));
  const keyStyle = { minWidth: "2.35rem", padding: "6px 0", flex: "0 0 2.35rem" } as const;
  const keyRow = (keys: string[], id: string) =>
    <div key={id} style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 3 }}>
      {keys.map((key, index) => <DialogButton key={id + index}
        style={keyStyle} disabled={!state.active}
        onClick={() => add(key)}>{shift ? key.toUpperCase() : key}</DialogButton>)}
    </div>;

  return <>
    <Field label="Klawiatura ekranowa"
      description="Wpisywanie kontrolerem bez konieczności wywoływania klawiatury SteamOS.">
      <DialogButton disabled={!state.active} onClick={() => setExpanded(value => !value)}>
        {expanded && state.active ? "Ukryj klawiaturę" : "Pokaż klawiaturę"}
      </DialogButton>
    </Field>
    {expanded && state.active && <div style={{ maxWidth: "100%", overflowX: "hidden" }}>
      {keyRow(Array.from("1234567890"), "digits")}
      {!symbols
        ? LETTER_ROWS.map((letters, i) => keyRow(Array.from(letters), "letter" + i))
        : [SYMBOLS.slice(0, 10), SYMBOLS.slice(10)].map((row, i) => keyRow(row, "symbol" + i))}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <DialogButton onClick={() => setShift(value => !value)}>{shift ? "abc" : "ABC"}</DialogButton>
        <DialogButton onClick={() => setSymbols(value => !value)}>{symbols ? "Litery" : "Znaki"}</DialogButton>
        <DialogButton disabled={!state.command.length} onClick={erase}>⌫ Usuń</DialogButton>
        <DialogButton onClick={() => add(" ")}>Spacja</DialogButton>
        <DialogButton disabled={!state.command.length} onClick={() => state.setCommand("")}>Wyczyść</DialogButton>
        <DialogButton disabled={!state.command.trim()} onClick={state.submit}>↵ Wyślij</DialogButton>
      </div>
    </div>}
  </>;
}

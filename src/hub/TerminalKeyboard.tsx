import { useState } from "react";
import { DialogButton } from "@decky/ui";
import type { TerminalLayoutState } from "../modules/terminal/TerminalView";

/** On-screen gamepad keyboard: its visibility and typing never require an
 * active PTY session. Commands are only executed after an explicit send.
 */
const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const SYMBOLS = ["/", "-", "_", "~", ".", ":", "=", "|", "&", "\\", "'", '"', "$", "*", "+", "?", "!", "@", "#", "%"];

export function TerminalKeyboard({ state, showExtraKeys }: {
  state: TerminalLayoutState;
  showExtraKeys: boolean;
}) {
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const add = (key: string) => state.setCommand(state.command + (shift ? key.toUpperCase() : key));
  const erase = () => state.setCommand(Array.from(state.command).slice(0, -1).join(""));
  const keyStyle = { minWidth: "2.55rem", minHeight: "2rem", padding: "4px 0", flex: "1 0 2.55rem" } as const;
  const keyRow = (keys: string[], id: string) =>
    <div key={id} style={{ display: "flex", gap: 3, marginBottom: 3, width: "100%" }}>
      {keys.map((key, index) => <DialogButton key={id + index}
        style={keyStyle} onClick={() => add(key)}>{shift ? key.toUpperCase() : key}</DialogButton>)}
    </div>;

  return <div aria-label="Klawiatura ekranowa" style={{ width: "100%", boxSizing: "border-box" }}>
    {keyRow(Array.from("1234567890"), "digits")}
    {!symbols
      ? LETTER_ROWS.map((letters, i) => keyRow(Array.from(letters), "letter" + i))
      : [SYMBOLS.slice(0, 10), SYMBOLS.slice(10)].map((row, i) => keyRow(row, "symbols" + i))}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      <DialogButton onClick={() => setShift(value => !value)}>{shift ? "abc" : "ABC"}</DialogButton>
      <DialogButton onClick={() => setSymbols(value => !value)}>{symbols ? "Litery" : "Znaki"}</DialogButton>
      <DialogButton disabled={!state.command.length} onClick={erase}>⌫</DialogButton>
      <DialogButton onClick={() => add(" ")}>Spacja</DialogButton>
      <DialogButton disabled={!state.command.length} onClick={() => state.setCommand("")}>Wyczyść</DialogButton>
      <DialogButton disabled={!state.active || !state.command.trim()} onClick={state.submit}>↵ Wyślij</DialogButton>
      {showExtraKeys && <>
        <DialogButton disabled={!state.active} onClick={() => state.send("\u0003")}>Ctrl+C</DialogButton>
        <DialogButton disabled={!state.active} onClick={() => state.send("\t")}>Tab</DialogButton>
        <DialogButton disabled={!state.active} onClick={() => state.send("\r")}>Enter</DialogButton>
      </>}
    </div>
  </div>;
}

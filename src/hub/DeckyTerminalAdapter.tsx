import { callable } from "@decky/api";
import {
  DialogBody, DialogButton, DialogControlsSection,
  DialogControlsSectionHeader, Field, TextField
} from "@decky/ui";
import { TerminalView } from "../modules/terminal/TerminalView";
import type { TerminalLayoutState } from "../modules/terminal/TerminalView";
import type { TerminalBridge, TerminalRead } from "../modules/terminal/bridge";

/** Only this transport adapter and layout import Decky. */
const start = callable<[number, number], { id: string }>("terminal_start");
const read = callable<[string], TerminalRead>("terminal_read");
const write = callable<[string, string], { ok: boolean }>("terminal_write");
const resize = callable<[string, number, number], { ok: boolean }>("terminal_resize");
const close = callable<[string], { ok: boolean }>("terminal_close");

const bridge: TerminalBridge = { start, read, write, resize, close };

function renderSteamOSLayout(state: TerminalLayoutState) {
  return <DialogBody>
    <DialogControlsSection>
      <DialogControlsSectionHeader>Terminal</DialogControlsSectionHeader>
      <Field label="Sesja terminala" description={state.status}>
        <div style={{ display: "flex", gap: 8 }}>
          <DialogButton disabled={state.pending || state.active} onClick={state.start}>
            {state.pending ? "Czekaj…" : state.active ? "Uruchomiona" : "Uruchom"}
          </DialogButton>
          <DialogButton disabled={!state.hasSession} onClick={state.close}>Zamknij</DialogButton>
        </div>
      </Field>
      <Field label="Ekran terminala"
        description="Wyjście powłoki systemowej. Sesja działa jako zwykły użytkownik." />
      {state.terminalElement}
      <Field label="Polecenie"
        description="Wpisz polecenie lub użyj klawiatury bezpośrednio w terminalu.">
        <TextField
          value={state.command}
          disabled={!state.active}
          onChange={event => state.setCommand(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") state.submit(); }}
        />
      </Field>
      <Field label="Wyślij polecenie">
        <DialogButton disabled={!state.active || !state.command.trim()}
          onClick={state.submit}>Wyślij</DialogButton>
      </Field>
      <Field label="Klawisze dodatkowe" description="Sterowanie także za pomocą kontrolera.">
        <div style={{ display: "flex", gap: 8 }}>
          <DialogButton disabled={!state.active} onClick={() => state.send("\u0003")}>Ctrl+C</DialogButton>
          <DialogButton disabled={!state.active} onClick={() => state.send("\t")}>Tab</DialogButton>
          <DialogButton disabled={!state.active} onClick={() => state.send("\r")}>Enter</DialogButton>
        </div>
      </Field>
      <Field label="Opcje zaawansowane" description="Informacje o działaniu terminala">
        <DialogButton onClick={state.toggleAdvanced}>
          {state.advanced ? "Zwiń" : "Rozwiń"}
        </DialogButton>
      </Field>
      {state.advanced && <>
        <Field label="Uprawnienia" description="Powłoka uruchamiana bez uprawnień root." />
        <Field label="Sesje" description="Maksymalnie 3 sesje. Zamknięcie panelu kończy sesję." />
        <Field label="Silnik" description="Linux PTY niezależny od Steam i Decky." />
      </>}
    </DialogControlsSection>
  </DialogBody>;
}

export function DeckyTerminalPage() {
  return <TerminalView bridge={bridge} render={renderSteamOSLayout} />;
}

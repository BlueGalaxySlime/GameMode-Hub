import { DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field, SliderField } from "@decky/ui";
import { useHubSessionState } from "./useHubSessionState";
import { FocusableInfoField } from "./FocusableInfoField";
import { GamepadScrollArea } from "./GamepadScrollArea";

/**
 * Emergency safe mode. Do not mount xterm, query Decky RPC or create PTYs.
 * On actual Legion Go S hardware a live terminal displayed unrelated
 * Unifideck Python tracebacks, followed by a Steam UI restart.
 * Preserve the standalone PTY implementation in source for investigation,
 * but do not execute it until the crash has been isolated.
 */
export function DeckyTerminalPage({ fontSize: _fontSize }: { fontSize: number }) {
  const [selected, setSelected] = useHubSessionState("terminal.selected",0);
  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
      <DialogControlsSectionHeader>Terminal — tryb bezpieczny</DialogControlsSectionHeader>
      <Field label="Sesja terminala" description="Wybierz sesję 1, 2 lub 3. Uruchamianie powłoki jest tymczasowo wstrzymane.">
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(index => <DialogButton key={index}
            aria-label={"Sesja " + (index + 1)}
            style={{ minWidth: "2.4rem", background: selected === index ? "#426b99" : undefined }}
            onClick={() => setSelected(index)}>{index + 1}</DialogButton>)}
        </div>
      </Field>
      <FocusableInfoField label={"Sesja " + (selected + 1) + " — niedostępna"}
        description="Nie uruchamiamy terminala, ponieważ poprzednia wersja powodowała restart interfejsu Steam. Nie zostaną wysłane żadne polecenia do systemu." />
      <FocusableInfoField label="Diagnostyka"
        description="Na nagraniu z Legion Go S widać przed restartem traceback Pythona ze ścieżkami Unifideck. Nie wiemy jeszcze, czy jest on przyczyną awarii, czy tylko jej objawem." />
      <FocusableInfoField label="Pozostałe funkcje"
        description="Pulpit, Dodatki, Aktualizacje i Podziękowania działają niezależnie od wyłączonego modułu terminala." />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

export function TerminalOptionsPage({ fontSize, setFontSize }: {
  fontSize: number;
  setFontSize(value: number): void;
}) {
  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
      <DialogControlsSectionHeader>Opcje terminala</DialogControlsSectionHeader>
      <FocusableInfoField label="Tryb bezpieczny" description="Moduł PTY i emulator xterm.js są tymczasowo wyłączone, aby nie narażać interfejsu Steam na kolejne restarty." />
      <Field label="Rozmiar czcionki" description="Ustawienie zostanie wykorzystane po przywróceniu działania terminala.">
        <SliderField min={11} max={22} step={1} value={fontSize}
          showValue onChange={setFontSize} />
      </Field>
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

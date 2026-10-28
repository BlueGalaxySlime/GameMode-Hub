import { DialogBody, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { GamepadScrollArea } from "./GamepadScrollArea";

/** Account connections are intentionally not faked: no providers or tokens exist yet. */
export function AccountsPage() {
  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Konta</DialogControlsSectionHeader>
        <Field label="Połączenia kont" focusable highlightOnFocus
          description="To miejsce na zarządzanie kontami i integracjami. Łączenie z usługami nie jest jeszcze dostępne." />
        <Field label="Prywatność" focusable highlightOnFocus
          description="GameMode Hub nie pobiera ani nie zapisuje w tej sekcji danych logowania, haseł ani tokenów." />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

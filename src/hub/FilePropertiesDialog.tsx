import { DialogButton, ModalRoot } from "@decky/ui";
import { fileProperties } from "../core/fileProperties";
import type { FilePropertyEntry } from "../core/fileProperties";
import { FocusableInfoField } from "./FocusableInfoField";
import { GamepadScrollArea } from "./GamepadScrollArea";

/** Properties are informational only. Opening this dialog never modifies a file. */
export function FilePropertiesDialog({ entry, closeModal }: {
  entry: FilePropertyEntry;
  closeModal?: () => void;
}) {
  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 9,
      padding: 12, width: "min(86vw, 520px)", maxWidth: "100%",
      boxSizing: "border-box", minWidth: 0 }}>
      <strong>Właściwości</strong>
      <GamepadScrollArea>
        {fileProperties(entry).map(property =>
          <FocusableInfoField key={property.label}
            label={property.label} description={property.description} />)}
      </GamepadScrollArea>
      <DialogButton onClick={() => closeModal?.()}>Zamknij</DialogButton>
    </div>
  </ModalRoot>;
}

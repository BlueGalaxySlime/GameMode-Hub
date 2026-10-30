import { DialogButton, Field, Focusable, NavEntryPositionPreferences, Toggle } from "@decky/ui";

/** One native framed settings row, with an independent compact action and toggle. */
export function OptimizationManageControl({ label, busy, enabled, onManage, onToggle }: {
  label: "Karty" | "Kolekcje";
  busy: boolean;
  enabled: boolean;
  onManage: (parent: EventTarget | null) => void;
  onToggle: (enabled: boolean) => void;
}) {
  return <Field label={label} description={label === "Karty"
    ? "Karty w bibliotece Steam Gaming Mode."
    : "Kolekcje utworzone w Hubie."}>
    <Focusable flow-children="row"
      navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
      style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <DialogButton disabled={busy}
        style={{ width: "fit-content", minWidth: 0, maxWidth: 160, flex: "0 0 auto" }}
        onClick={event => onManage(event.currentTarget)}>
        {label}
      </DialogButton>
      <Toggle value={enabled} disabled={busy} onChange={onToggle} />
    </Focusable>
  </Field>;
}

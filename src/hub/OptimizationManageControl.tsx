import type { ReactNode } from "react";
import { DialogButton, Focusable, NavEntryPositionPreferences, Toggle } from "@decky/ui";

/** Same compact SteamOS action and an independent ON/OFF control in both sections. */
export function OptimizationManageControl({ busy, enabled, onManage, onToggle }: {
  busy: boolean;
  enabled: boolean;
  onManage: (parent: EventTarget | null) => void;
  onToggle: (enabled: boolean) => void;
}) {
  return <Focusable flow-children="row"
    navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
    style={{ display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
    <DialogButton disabled={busy}
      style={{ width: "fit-content", minWidth: 0, maxWidth: 160, flex: "0 0 auto" }}
      onClick={event => onManage(event.currentTarget)}>
      Zarządzaj
    </DialogButton>
    <Toggle value={enabled} disabled={busy}
      onChange={onToggle} />
  </Focusable>;
}

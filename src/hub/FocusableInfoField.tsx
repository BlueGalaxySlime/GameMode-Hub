import { useState } from "react";
import { DialogButton } from "@decky/ui";

/** Informational row with a real Steam controller focus target. */
export function FocusableInfoField({ label, description }: {
  label: string; description: string;
}) {
  const [expanded, setExpanded] = useState(true);
  return <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
    <DialogButton onClick={() => setExpanded(open => !open)}
      onOKActionDescription={expanded ? "Zwiń szczegóły" : "Rozwiń szczegóły"}
      style={{ width: "100%", minWidth: 0, textAlign: "left",
        fontWeight: 600, padding: "7px 9px" }}>
      {label + (expanded ? " ▴" : " ▾")}
    </DialogButton>
    {expanded && <div style={{ padding: "3px 9px 12px", fontSize: 12, opacity: 0.83,
      overflowWrap: "anywhere" }}>{description}</div>}
  </div>;
}

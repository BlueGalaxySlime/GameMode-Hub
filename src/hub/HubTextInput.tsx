import { useSyncExternalStore } from "react";
import type { CSSProperties, ChangeEventHandler, KeyboardEventHandler } from "react";
import { TextField } from "@decky/ui";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";

/**
 * One shared Hub text input policy for every editable SteamOS field.
 *
 * Steam's TextField provides its integrated on-screen keyboard when enabled.
 * A native input with inputMode=none handles real hardware keyboards without
 * requesting the software keyboard when disabled. No extra OK/Cancel buttons.
 */
export type HubTextInputProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  "aria-label"?: string;
};

export function HubTextInput(props: HubTextInputProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  if (options.autoKeyboard) {
    return <TextField {...props} />;
  }
  return <input {...props} type="text" inputMode="none" autoComplete="off"
    spellCheck={false} style={{
      display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
      borderRadius: 4, padding: "8px 10px",
      background: "#333d50", color: "inherit", border: "1px solid #68748a",
      font: "inherit", ...props.style
    }} />;
}

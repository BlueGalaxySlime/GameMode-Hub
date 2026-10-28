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
  focusOnMount?: boolean;
};

export function HubTextInput(props: HubTextInputProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const { focusOnMount, ...fieldProps } = props;
  if (options.autoKeyboard) {
    return <TextField {...fieldProps} focusOnMount={focusOnMount} />;
  }
  return <input {...fieldProps} type="text" inputMode="none" autoComplete="off"
    autoFocus={focusOnMount}
    spellCheck={false} style={{
      display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
      borderRadius: 4, padding: "8px 10px",
      background: "#333d50", color: "inherit", border: "1px solid #68748a",
      font: "inherit", ...props.style
    }} />;
}

/** Larger multiline counterpart with the same shared keyboard preference.
 * Steam TextField is single-line, so use a native textarea for long reports.
 */
export type HubTextAreaProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  style?: CSSProperties;
  "aria-label"?: string;
};

export function HubTextArea(props: HubTextAreaProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  return <textarea {...props} inputMode={options.autoKeyboard ? "text" : "none"}
    autoComplete="off" spellCheck={false} style={{
      display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
      minHeight: 116, maxHeight: 220, resize: "vertical", borderRadius: 4,
      padding: "10px 12px", background: "#333d50", color: "inherit",
      border: "1px solid #68748a", font: "inherit", lineHeight: 1.4,
      ...props.style
    }} />;
}

import { useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ChangeEventHandler, KeyboardEventHandler, ReactNode } from "react";
import { Focusable, GamepadButton, Menu, MenuItem, TextField, showContextMenu } from "@decky/ui";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
import { moveTextCaret, selectionWithHead } from "../core/textSelection";
import type { TextDirection } from "../core/textSelection";

type Editor = HTMLInputElement | HTMLTextAreaElement;
type EditControlsProps = {
  value: string;
  disabled?: boolean;
  onEditValue?: (next: string) => void;
  onExitEdit?: () => void;
  multiline: boolean;
  children: ReactNode;
};

/**
 * The focused editor owns B/Y. First B anchors a selection; subsequent B
 * leaves editing. Outside editing the surrounding SteamOS navigation is
 * untouched. Direction events do not distinguish stick from D-pad on every
 * SteamOS version, so B is always the escape route.
 */
function TextEditControls({ value, disabled, onEditValue, onExitEdit, multiline, children }: EditControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(0);
  const headRef = useRef(0);
  const selectingRef = useRef(false);
  const [selecting, setSelecting] = useState(false);
  const [message, setMessage] = useState("");

  function editor(): Editor | null {
    return containerRef.current?.querySelector<Editor>("input, textarea") ?? null;
  }

  function beginOrExitSelection() {
    const field = editor();
    if (!field || disabled) return;
    if (selectingRef.current) {
      selectingRef.current = false;
      setSelecting(false);
      onExitEdit?.();
      return;
    }
    const caret = field.selectionEnd ?? 0;
    anchorRef.current = caret;
    headRef.current = caret;
    selectingRef.current = true;
    setSelecting(true);
    setMessage("");
    field.focus({ preventScroll: true });
    field.setSelectionRange(caret, caret);
  }

  function moveSelection(direction: TextDirection) {
    const field = editor();
    if (!field || disabled || !selectingRef.current) return;
    headRef.current = moveTextCaret(value, headRef.current, direction, multiline);
    const range = selectionWithHead(anchorRef.current, headRef.current);
    field.setSelectionRange(range.start, range.end, range.direction);
  }

  function restoreCaret(at: number) {
    window.setTimeout(() => {
      const field = editor();
      if (!field) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(at, at);
    }, 0);
  }

  function replaceRange(start: number, end: number, inserted: string) {
    if (!onEditValue || disabled) return;
    const next = value.slice(0, start) + inserted + value.slice(end);
    const caret = start + inserted.length;
    onEditValue(next);
    anchorRef.current = caret;
    headRef.current = caret;
    selectingRef.current = false;
    setSelecting(false);
    restoreCaret(caret);
  }

  function openTextMenu(parent: EventTarget) {
    const field = editor();
    if (!field || disabled) return;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const highlighted = value.slice(start, end);

    async function copy(cut: boolean) {
      if (!highlighted) return;
      try {
        await navigator.clipboard.writeText(highlighted);
        if (cut) replaceRange(start, end, "");
        else setMessage("Skopiowano tekst.");
      } catch {
        setMessage("Schowek SteamOS jest niedostępny. Tekst pozostaje bez zmian.");
      }
    }

    async function paste() {
      try {
        const pasted = await navigator.clipboard.readText();
        if (!pasted) return;
        replaceRange(start, end, pasted);
      } catch {
        setMessage("SteamOS nie udostępnił tekstu ze schowka.");
      }
    }

    showContextMenu(
      <Menu label="Edycja tekstu">
        <MenuItem disabled={!highlighted} onSelected={() => { void copy(false); }}>Kopiuj</MenuItem>
        <MenuItem disabled={!highlighted || !onEditValue} onSelected={() => { void copy(true); }}>Wytnij</MenuItem>
        <MenuItem disabled={!onEditValue} onSelected={() => { void paste(); }}>Wklej</MenuItem>
        <MenuItem disabled={!value} onSelected={() => {
          field.focus({ preventScroll: true });
          field.setSelectionRange(0, value.length);
          anchorRef.current = 0;
          headRef.current = value.length;
          selectingRef.current = true;
          setSelecting(true);
        }}>Zaznacz wszystko</MenuItem>
      </Menu>, parent, { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
    );
  }

  function gamepadDirection(button: GamepadButton): TextDirection | null {
    if (button === GamepadButton.DIR_LEFT) return "left";
    if (button === GamepadButton.DIR_RIGHT) return "right";
    if (button === GamepadButton.DIR_UP) return "up";
    if (button === GamepadButton.DIR_DOWN) return "down";
    return null;
  }

  return <Focusable ref={containerRef} flow-children="column"
    onCancelActionDescription={selecting ? "Zakończ edycję" : "Zaznaczanie tekstu"}
    onOptionsActionDescription="Wytnij / Kopiuj / Wklej"
    onCancelButton={event => {
      if (event.defaultPrevented || !editor()) return;
      event.preventDefault();
      event.stopPropagation();
      beginOrExitSelection();
    }}
    onOptionsButton={event => {
      if (event.defaultPrevented || !editor()) return;
      event.preventDefault();
      event.stopPropagation();
      openTextMenu(event.currentTarget ?? window);
    }}
    onGamepadDirection={event => {
      const direction = gamepadDirection(event.detail.button);
      if (!direction || !selectingRef.current || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      moveSelection(direction);
    }}
    onContextMenu={event => {
      event.preventDefault();
      event.stopPropagation();
      openTextMenu(event.currentTarget);
    }}
    style={{ width: "100%", minWidth: 0 }}>
    {children}
    {selecting && <span role="status" style={{ fontSize: 11, opacity: 0.9 }}>
      Zaznaczanie: kierunki przesuwają koniec zaznaczenia · B kończy edycję · Y otwiera menu
    </span>}
    {!!message && <span role="status" style={{ fontSize: 11, opacity: 0.9 }}>{message}</span>}
  </Focusable>;
}

/** One shared policy for all active single-line Hub fields. */
export type HubTextInputProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onEditValue?: (value: string) => void;
  onExitEdit?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  "aria-label"?: string;
  focusOnMount?: boolean;
};

export function HubTextInput(props: HubTextInputProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const { focusOnMount, onEditValue, onExitEdit, ...fieldProps } = props;
  return <TextEditControls value={props.value} multiline={false} disabled={props.disabled}
    onEditValue={onEditValue} onExitEdit={onExitEdit}>
    {options.autoKeyboard
      ? <TextField {...fieldProps} focusOnMount={focusOnMount} />
      : <input {...fieldProps} type="text" inputMode="none" autoComplete="off"
          autoFocus={focusOnMount} spellCheck={false} style={{
            display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
            borderRadius: 4, padding: "8px 10px",
            background: "#333d50", color: "inherit", border: "1px solid #68748a",
            font: "inherit", ...props.style
          }} />}
  </TextEditControls>;
}

/** Multiline report textarea shares the same active-field controller behavior. */
export type HubTextAreaProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onEditValue?: (value: string) => void;
  onExitEdit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  style?: CSSProperties;
  "aria-label"?: string;
  focusOnMount?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
};

export function HubTextArea(props: HubTextAreaProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const { focusOnMount, onEditValue, onExitEdit, ...fieldProps } = props;
  return <TextEditControls value={props.value} multiline disabled={props.disabled}
    onEditValue={onEditValue} onExitEdit={onExitEdit}>
    <textarea {...fieldProps} autoFocus={focusOnMount}
      inputMode={options.autoKeyboard ? "text" : "none"}
      autoComplete="off" spellCheck={false} style={{
        display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
        minHeight: 116, maxHeight: 220, resize: "none",
        padding: "8px 10px", background: "transparent", color: "inherit",
        border: "none", borderRadius: 0, font: "inherit", lineHeight: 1.4,
        ...props.style
      }} />
  </TextEditControls>;
}

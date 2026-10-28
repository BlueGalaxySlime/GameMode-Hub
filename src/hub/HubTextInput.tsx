import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ChangeEventHandler, KeyboardEventHandler, ReactNode } from "react";
import { DialogButton, Focusable, GamepadButton, Menu, MenuItem, TextField, showContextMenu } from "@decky/ui";
import { getHubPreferences, subscribeHubPreferences } from "../core/hubSession";
import { moveTextCaret, selectionWithHead } from "../core/textSelection";
import type { TextDirection } from "../core/textSelection";

/** Open native text actions while the row is focused but the Steam keyboard is closed. */
export function openHubTextMenu(args: {
  parent: EventTarget;
  value: string;
  onEditValue?: (next: string) => void;
  onStartSelection: (all?: boolean) => void;
  onClear?: () => void;
  onUndoClear?: () => void;
  canUndoClear?: boolean;
}) {
  const { parent, value, onEditValue, onStartSelection, onClear, onUndoClear, canUndoClear } = args;
  async function copyAll(cut: boolean) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (cut) onEditValue?.("");
    } catch {
      // No mutations when SteamOS denies clipboard access.
    }
  }
  async function paste() {
    try {
      const contents = await navigator.clipboard.readText();
      if (contents && onEditValue) onEditValue(value + contents);
    } catch {
      // Clipboard may be inaccessible in Gaming Mode.
    }
  }
  showContextMenu(
    <Menu label="Edycja tekstu">
      <MenuItem disabled={!value} onSelected={() => onStartSelection(false)}>
        Tryb zaznaczania tekstu
      </MenuItem>
      <MenuItem disabled={!value} onSelected={() => onStartSelection(true)}>Zaznacz wszystko</MenuItem>
      <MenuItem disabled={!value} onSelected={() => { void copyAll(false); }}>Kopiuj</MenuItem>
      <MenuItem disabled={!value || !onEditValue} onSelected={() => { void copyAll(true); }}>Wytnij</MenuItem>
      <MenuItem disabled={!onEditValue} onSelected={() => { void paste(); }}>Wklej</MenuItem>
      <MenuItem disabled={!value || !onEditValue} onSelected={() => {
        if (onClear) onClear(); else onEditValue?.("");
      }}>Wyczyść wszystko</MenuItem>
      {canUndoClear && onUndoClear && <MenuItem onSelected={onUndoClear}>Cofnij wyczyszczenie</MenuItem>}
    </Menu>, parent, { bFitToWindow: true, bShiftToFitWindow: true, bPreferPopTop: true }
  );
}

type Editor = HTMLInputElement | HTMLTextAreaElement;
type EditControlsProps = {
  value: string;
  disabled?: boolean;
  onEditValue?: (next: string) => void;
  onExitEdit?: () => void;
  multiline: boolean;
  startInSelectionMode?: boolean;
  children: ReactNode;
};

/**
 * Y opens edit actions. Unlike regular input editing, selection mode uses a
 * dedicated Steam-focusable row: a pad direction can be handled without moving
 * the Hub focus to a neighbouring control. B exits selection mode, never
 * starts it. Outside that mode B is left entirely to the parent/SteamOS.
 */
function TextEditControls({ value, disabled, onEditValue, onExitEdit, multiline,
  startInSelectionMode = false, children }: EditControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRowRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(0);
  const headRef = useRef(0);
  const selectingRef = useRef(startInSelectionMode && !!value);
  const lastDirectionRef = useRef<{ direction: TextDirection | null; at: number }>({ direction: null, at: 0 });
  const lastClearRef = useRef<string | null>(null);
  const [selecting, setSelecting] = useState(startInSelectionMode && !!value);
  const [message, setMessage] = useState("");

  function editor(): Editor | null {
    return containerRef.current?.querySelector<Editor>("input, textarea") ?? null;
  }

  function focusSelectionRow() {
    selectionRowRef.current?.querySelector<HTMLElement>(
      'button, [role="button"], [tabindex]'
    )?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!selecting) return;
    focusSelectionRow();
    // A native Steam context menu can restore its previous focus on dismissal.
    const task = window.setTimeout(focusSelectionRow, 0);
    return () => window.clearTimeout(task);
  }, [selecting]);

  function restoreCaret(at: number) {
    window.setTimeout(() => {
      const field = editor();
      if (!field) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(at, at);
    }, 0);
  }

  function startSelectionMode(selectAll = false) {
    if (disabled || !value) return;
    const field = editor();
    const caret = Math.max(0, Math.min(value.length, field?.selectionEnd ?? value.length));
    anchorRef.current = selectAll ? 0 : caret;
    headRef.current = selectAll ? value.length : caret;
    selectingRef.current = true;
    setSelecting(true);
    setMessage("");
  }

  function exitSelectionMode() {
    if (!selectingRef.current) return;
    selectingRef.current = false;
    setSelecting(false);
    if (onExitEdit) onExitEdit();
    else restoreCaret(headRef.current);
  }

  function moveSelection(direction: TextDirection) {
    if (disabled || !selectingRef.current) return;
    const now = Date.now();
    // Steam can emit onButtonDown AND onGamepadDirection for one D-pad press.
    if (lastDirectionRef.current.direction === direction &&
        now - lastDirectionRef.current.at < 25) return;
    lastDirectionRef.current = { direction, at: now };
    headRef.current = moveTextCaret(value, headRef.current, direction, multiline);
    // Re-render the highlight without touching the underlying input value.
    setSelectionRevision(revision => revision + 1);
  }

  const [, setSelectionRevision] = useState(0);

  function replaceRange(start: number, end: number, inserted: string) {
    if (!onEditValue || disabled) return;
    const next = value.slice(0, start) + inserted + value.slice(end);
    const caret = start + inserted.length;
    onEditValue(next);
    anchorRef.current = caret;
    headRef.current = caret;
    if (selectingRef.current) {
      setSelectionRevision(revision => revision + 1);
      window.setTimeout(focusSelectionRow, 0);
    } else {
      restoreCaret(caret);
    }
  }

  function selectionRange() {
    if (selectingRef.current) return selectionWithHead(anchorRef.current, headRef.current);
    const field = editor();
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? start;
    return { start, end };
  }

  function openTextMenu(parent: EventTarget) {
    if (disabled || (!editor() && !selectingRef.current)) return;
    const range = selectionRange();
    const { start, end } = range;
    const highlighted = value.slice(start, end);

    async function copy(cut: boolean) {
      if (!highlighted) return;
      try {
        await navigator.clipboard.writeText(highlighted);
        if (cut) replaceRange(start, end, "");
        else {
          setMessage("Skopiowano tekst.");
          if (selectingRef.current) window.setTimeout(focusSelectionRow, 0);
        }
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
        <MenuItem disabled={!value} onSelected={() => startSelectionMode()}>
          Tryb zaznaczania tekstu
        </MenuItem>
        <MenuItem disabled={!highlighted} onSelected={() => { void copy(false); }}>Kopiuj</MenuItem>
        <MenuItem disabled={!highlighted || !onEditValue} onSelected={() => { void copy(true); }}>Wytnij</MenuItem>
        <MenuItem disabled={!onEditValue} onSelected={() => { void paste(); }}>Wklej</MenuItem>
        <MenuItem disabled={!value} onSelected={() => startSelectionMode(true)}>Zaznacz wszystko</MenuItem>
        <MenuItem disabled={!value || !onEditValue} onSelected={() => {
          lastClearRef.current = value;
          replaceRange(0, value.length, "");
          setMessage("Wyczyszczono całe pole.");
        }}>Wyczyść wszystko</MenuItem>
        {lastClearRef.current !== null && <MenuItem onSelected={() => {
          const previous = lastClearRef.current;
          if (previous === null || !onEditValue) return;
          lastClearRef.current = null;
          onEditValue(previous);
          restoreCaret(previous.length);
          setMessage("Przywrócono tekst.");
        }}>Cofnij wyczyszczenie</MenuItem>}
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

  const selection = selectionWithHead(anchorRef.current, headRef.current);
  const prefix = value.slice(0, selection.start);
  const highlighted = value.slice(selection.start, selection.end);
  const suffix = value.slice(selection.end);

  return <Focusable ref={containerRef} flow-children="column"
    onCancelActionDescription={selecting ? "Wyjdź z zaznaczania" : "Zamknij edycję"}
    onCancelButton={event => {
      if (event.defaultPrevented || (!editor() && !selectingRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
      if (selectingRef.current) exitSelectionMode();
      else onExitEdit?.();
    }}
    onMenuActionDescription="Edycja tekstu"
    onMenuButton={event => {
      if (event.defaultPrevented || (!editor() && !selectingRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
      openTextMenu(event.currentTarget ?? window);
    }}
    onContextMenu={event => {
      event.preventDefault();
      event.stopPropagation();
      openTextMenu(event.currentTarget);
    }}
    style={{ width: "100%", minWidth: 0 }}>
    {!selecting && children}
    {selecting && <div ref={selectionRowRef} style={{ width: "100%" }}>
      <DialogButton preferredFocus
        onCancelActionDescription="Wyjdź z zaznaczania"
        onCancelButton={event => {
          event.preventDefault();
          event.stopPropagation();
          exitSelectionMode();
        }}
        onMenuActionDescription="Edycja tekstu"
        onMenuButton={event => {
          event.preventDefault();
          event.stopPropagation();
          openTextMenu(event.currentTarget ?? window);
        }}
        onButtonDown={event => {
          const direction = gamepadDirection(event.detail.button);
          if (!direction || event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          moveSelection(direction);
        }}
        onGamepadDirection={event => {
          const direction = gamepadDirection(event.detail.button);
          if (!direction || event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          moveSelection(direction);
        }}
        onKeyDown={event => {
          if (event.key === "Escape" || event.key === "Backspace") {
            event.preventDefault();
            event.stopPropagation();
            exitSelectionMode();
            return;
          }
          const direction = ({
            ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down"
          } as Record<string, TextDirection>)[event.key];
          if (!direction) return;
          event.preventDefault();
          event.stopPropagation();
          moveSelection(direction);
        }}
        style={{ width: "100%", textAlign: "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        <span aria-label="Zaznaczany tekst">
          {prefix}
          {selection.start === selection.end ? <strong aria-hidden="true">│</strong> :
            <span style={{ background: "#466fa6", color: "#fff" }}>{highlighted}</span>}
          {suffix}
        </span>
      </DialogButton>
      <div role="status" style={{ fontSize: 11, opacity: 0.9 }}>
        Zaznaczanie: krzyżak wybiera tekst · ☰: kopiuj / wytnij / wklej · B: wyjdź
      </div>
    </div>}
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
  startInSelectionMode?: boolean;
};

export function HubTextInput(props: HubTextInputProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const { focusOnMount, startInSelectionMode, onEditValue, onExitEdit, ...fieldProps } = props;
  return <TextEditControls value={props.value} multiline={false} disabled={props.disabled}
    startInSelectionMode={startInSelectionMode}
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
  startInSelectionMode?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
};

export function HubTextArea(props: HubTextAreaProps) {
  const options = useSyncExternalStore(subscribeHubPreferences, getHubPreferences);
  const { focusOnMount, startInSelectionMode, onEditValue, onExitEdit, ...fieldProps } = props;
  return <TextEditControls value={props.value} multiline disabled={props.disabled}
    startInSelectionMode={startInSelectionMode}
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

/** Offsets use UTF-16 code units, matching HTMLInputElement.selectionStart. */
export type TextDirection = "left" | "right" | "up" | "down";

/** Move a caret inside a controlled input/textarea without changing its value. */
export function moveTextCaret(text: string, offset: number, direction: TextDirection, multiline: boolean): number {
  const at = Math.max(0, Math.min(text.length, offset));
  if (direction === "left") return Math.max(0, at - 1);
  if (direction === "right") return Math.min(text.length, at + 1);
  if (!multiline) return direction === "up" ? 0 : text.length;
  const lineStart = text.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  const column = at - lineStart;
  if (direction === "up") {
    if (lineStart === 0) return 0;
    const prevEnd = lineStart - 1;
    const prevStart = text.lastIndexOf("\n", Math.max(0, prevEnd - 1)) + 1;
    return prevStart + Math.min(column, prevEnd - prevStart);
  }
  const lineEnd = text.indexOf("\n", at);
  if (lineEnd < 0) return text.length;
  const nextStart = lineEnd + 1;
  const nextEnd = text.indexOf("\n", nextStart);
  return Math.min(nextStart + column, nextEnd < 0 ? text.length : nextEnd);
}

/** Selection follows a fixed anchor and moving caret, including reverse selections. */
export function selectionWithHead(anchor: number, head: number): {
  start: number; end: number; direction: "forward" | "backward";
} {
  return { start: Math.min(anchor, head), end: Math.max(anchor, head),
    direction: head < anchor ? "backward" : "forward" };
}

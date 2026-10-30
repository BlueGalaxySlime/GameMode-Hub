/** Controller-independent session navigation for the terminal's three slots. */
export const TERMINAL_SESSIONS = [0, 1, 2] as const;

export function nextTerminalSession(current: number, direction: -1 | 1): number {
  const selected = Number.isInteger(current) && current >= 0 && current < 3 ? current : 0;
  return (selected + direction + TERMINAL_SESSIONS.length) % TERMINAL_SESSIONS.length;
}

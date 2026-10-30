/** Lightweight session-tab state, independent of Steam, Decky and PTYs.
 * Session IDs remain stable when one tab closes, so future PTY ownership
 * cannot accidentally move to another tab.
 */
export const TERMINAL_SESSIONS = [0, 1, 2] as const;
export type TerminalTabs = { open: number[]; selected: number | null };
export const INITIAL_TERMINAL_TABS: TerminalTabs = { open: [0], selected: 0 };

export function normalizeTerminalTabs(state: TerminalTabs): TerminalTabs {
  const open = [...new Set((state?.open ?? [])
    .filter(id => Number.isInteger(id) && TERMINAL_SESSIONS.includes(id as 0 | 1 | 2)))]
    .sort((a, b) => a - b);
  const selected = state && state.selected !== null && open.includes(state.selected)
    ? state.selected : (open[0] ?? null);
  return { open, selected };
}

export function addTerminalSession(state: TerminalTabs): TerminalTabs {
  const current = normalizeTerminalTabs(state);
  const next = TERMINAL_SESSIONS.find(id => !current.open.includes(id));
  if (next === undefined) return current;
  return { open: [...current.open, next].sort((a, b) => a - b), selected: next };
}

export function closeTerminalSession(state: TerminalTabs, id: number): TerminalTabs {
  const current = normalizeTerminalTabs(state);
  const index = current.open.indexOf(id);
  if (index === -1) return current;
  const open = current.open.filter(value => value !== id);
  const selected = current.selected === id
    ? (open[Math.min(index, open.length - 1)] ?? null)
    : current.selected;
  return { open, selected };
}

export function selectTerminalSession(state: TerminalTabs, id: number): TerminalTabs {
  const current = normalizeTerminalTabs(state);
  return current.open.includes(id) ? { ...current, selected: id } : current;
}

/** LB/RB cycles only through tabs actually opened by the user. */
export function nextTerminalSession(
  current: number | null,
  direction: -1 | 1,
  open: readonly number[] = TERMINAL_SESSIONS
): number | null {
  if (!open.length) return null;
  const index = open.indexOf(current ?? -1);
  if (index < 0) return open[0];
  return open[(index + direction + open.length) % open.length];
}

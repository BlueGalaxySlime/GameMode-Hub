/**
 * Deliberately independent of Decky. A future desktop Linux frontend can
 * provide the same transport contract without changing TerminalView.
 */
export type TerminalRead = { data: string; running: boolean; truncated: boolean };
export type TerminalBridge = {
  start(cols: number, rows: number): Promise<{ id: string }>;
  read(id: string): Promise<TerminalRead>;
  write(id: string, base64: string): Promise<{ ok: boolean }>;
  resize(id: string, cols: number, rows: number): Promise<{ ok: boolean }>;
  close(id: string): Promise<{ ok: boolean }>;
};

/**
 * PTY transport independent of Decky and Steam. RPC adapter may vary by host.
 */
export type TerminalRead = { data: string; running: boolean; truncated: boolean };
export type TerminalBridge = {
  start(cols: number, rows: number): Promise<{ id: string }>;
  read(id: string): Promise<TerminalRead>;
  write(id: string, base64: string): Promise<{ ok: boolean }>;
  resize(id: string, cols: number, rows: number): Promise<{ ok: boolean }>;
  close(id: string): Promise<{ ok: boolean }>;
  ping?(): Promise<{ ok: boolean }>;
};

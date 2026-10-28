import { callable } from "@decky/api";
import { TerminalView } from "../modules/terminal/TerminalView";
import type { TerminalBridge, TerminalRead } from "../modules/terminal/bridge";

/** All Decky-specific code is isolated in this transport adapter. */
const start = callable<[number, number], { id: string }>("terminal_start");
const read = callable<[string], TerminalRead>("terminal_read");
const write = callable<[string, string], { ok: boolean }>("terminal_write");
const resize = callable<[string, number, number], { ok: boolean }>("terminal_resize");
const close = callable<[string], { ok: boolean }>("terminal_close");

const bridge: TerminalBridge = { start, read, write, resize, close };

export function DeckyTerminalPage() {
  return <TerminalView bridge={bridge} />;
}

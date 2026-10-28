/** In-memory terminal state owned by SteamHub, not by a routed React page.
 *
 * Leaving the Terminal section preserves PTY IDs and scrollback. Only
 * unloading SteamHub or an explicit session close destroys a backend PTY.
 * No session IDs are persisted to disk or exposed to other users.
 */
export type TerminalPhase = "idle" | "starting" | "connected" | "ended" | "unavailable";
export type TerminalSlot = {
  id: string | null;
  phase: TerminalPhase;
  error: string;
  output: string;
  starting: boolean;
};
const slots: TerminalSlot[] = Array.from({ length: 3 }, () => ({
  id: null, phase: "idle", error: "", output: "", starting: false
}));
let selectedSlot = 0;
let backendUnavailable = "";

export function getSlot(number: number): TerminalSlot {
  if (!Number.isInteger(number) || number < 0 || number > 2) {
    throw new RangeError("Only three terminal slots are available");
  }
  return slots[number];
}
export function getSelectedSlot() { return selectedSlot; }
export function selectSlot(number: number) {
  getSlot(number);
  selectedSlot = number;
}
export function getBackendError() { return backendUnavailable; }
export function markBackendUnavailable(error: string) {
  // Prevent subsequent start/retry calls from freezing Gaming Mode.
  backendUnavailable = error;
  for (const slot of slots) {
    if (slot.phase === "idle" || slot.phase === "starting") {
      slot.phase = "unavailable";
      slot.error = error;
      slot.starting = false;
    }
  }
}
export function appendOutput(slot: TerminalSlot, chunk: string) {
  slot.output = (slot.output + chunk).slice(-128 * 1024);
}
export function clearOutput(slot: TerminalSlot) {
  // Clearing display MUST NOT kill the shell or reset the terminal session.
  slot.output = "";
}

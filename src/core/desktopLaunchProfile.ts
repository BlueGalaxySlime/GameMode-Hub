/**
 * Backwards compatibility for the older window_profile field (v0.5.52).
 * Shrinking GTK/Qt/Electron GUI is intentionally disabled: it makes
 * tiny/letterboxed Gamescope windows even less usable.
 *
 * Only Steam's per-shortcut viewport option is modified (elsewhere).
 */
export type DesktopWindowProfile = "system" | "compact";

export type DesktopLaunchSpec = {
  bin: string;
  cmd: string;
  flatpak: boolean;
};

export function desktopLaunchProfile(
  app: DesktopLaunchSpec,
  _legacyProfile: DesktopWindowProfile = "system"
): { bin: string; cmd: string } {
  return { bin: app.bin, cmd: app.cmd };
}

/** Application UI scale only. Never touches Gamescope or the display resolution. */
export type DesktopWindowProfile = "system" | "compact";

export type DesktopLaunchSpec = {
  bin: string; cmd: string; flatpak: boolean;
};

const environment = [
  "GDK_SCALE=1",
  "GDK_DPI_SCALE=0.85",
  "QT_SCALE_FACTOR=0.85",
  "ELECTRON_FORCE_DEVICE_SCALE_FACTOR=0.85",
];

// Steam shortcut options are parsed as argv by Steam; protect quoted paths.
function quoteArg(value: string) {
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export function desktopLaunchProfile(
  app: DesktopLaunchSpec,
  profile: DesktopWindowProfile = "system"
): { bin: string; cmd: string } {
  if (profile !== "compact") return { bin: app.bin, cmd: app.cmd };

  // Flatpak doesn't reliably forward the parent process' GTK/Qt variables.
  // Set them inside the sandbox using documented flatpak-run --env flags.
  if (app.flatpak && /(^|\/)flatpak$/.test(app.bin) && /^run(?:\s|$)/.test(app.cmd)) {
    const options = environment.map(item => "--env=" + item).join(" ");
    return { bin: app.bin, cmd: app.cmd.replace(/^run/, "run " + options) };
  }

  // No shell interpolation, no sudo, no system-wide overrides.
  return {
    bin: "/usr/bin/env",
    cmd: environment.join(" ") + " " + quoteArg(app.bin) + (app.cmd ? " " + app.cmd : "")
  };
}

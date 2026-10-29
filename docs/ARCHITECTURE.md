# GameMode Hub architecture

GameMode Hub is an active Steam Gaming Mode plugin hosted by Decky Loader.
The independent launcher is a future goal. There is no separate module-loader
for third-party manifests; the old placeholder directory was removed.

## Current project layout

- `main.py`, `plugin.json`: required Decky entrypoint and plugin metadata.
- `backend/core/`: settings, release catalog, runtime state.
- `backend/files/`: file manager, trash, LAN file transfer.
- `backend/apps/`: application discovery and Flatpak integration.
- `backend/downloads/`: background jobs and update checks.
- `backend/library/`: tabs, collections, backups, game settings and badges.
- `src/hub/`: Decky UI pages and controller integration.
- `src/modules/`: existing reusable UI feature modules.
- `src/core/`: frontend logic independent of Steam/Decky.
- `desktop/`: dormant Electron prototype, excluded from releases.
- `terminal_core/`: disabled experimental PTY, excluded from releases.
- `tests/`: regression tests; `scripts/`: packaging; `docs/`: documentation.

Decky loads `main.py` by file path. It inserts the plugin root in `sys.path`
to import `backend.*` from its sandbox. Moving Python source files must not
change persisted user settings, Decky RPC names or the installation layout.
The ZIP is built by `scripts/package.py` using the `backend/` package.

## Earlier proposals (historical)

## Independent terminal (implementation)

- `terminal_core/service.py`: unprivileged Linux PTY engine, standard library
  only. It has no imports from Decky, Steam or the frontend.
- `terminal_core/worker.py`: child-only controlling-TTY setup. Spawned in a
  fresh interpreter and session; avoids unsafe `preexec_fn` in Decky's threads.
- `src/modules/terminal/TerminalView.tsx`: reusable xterm.js UI that consumes a
  `TerminalBridge` interface.
- `src/hub/DeckyTerminalAdapter.tsx`: only Decky-dependent part of the terminal.
- The backend refuses `root`, starts shells only on an explicit user action,
  buffers at most 256 KiB, and closes sessions on plugin unload. It does not
  require or integrate the unrelated Decky Terminal plugin.
- Future desktop/Linux application: implement a local authenticated transport
  against the same `TerminalBridge`; the engine and UI stay unchanged.
- Never expose the PTY API on a public network socket without authentication.


## Platform UI and attribution

- `TerminalView` exposes a platform-neutral presentation interface.
- `DeckyTerminalAdapter` provides native SteamOS `Field`, `DialogButton`
  and `TextField` components; a future Linux app may provide its own.
- `CreditsPage` explicitly separates adapted code from independent integrations.
  Legally required notices are kept in `THIRD_PARTY_NOTICES.md`.


## Terminal session lifecycle and fail-safe behavior (0.4.11)

- Three fixed PTY slots are managed by `sessionStore.ts` in the loaded frontend
  module. Route changes do not close the shell, and up to 128 KiB of output
  per slot can be replayed on return. Output while a panel is unmounted is
  buffered by the backend until the frontend requests it again.
- Terminals close only on plugin unload, when the shell exits, or on an
  explicit close request; clearing xterm never closes the PTY.
- The Decky adapter probes `terminal_ping` (protocol 2) before creating a shell.
  If the backend does not answer, further terminal attempts and polling are
  stopped for the current SteamHub plugin instance to avoid repeated stuck RPCs.
- `terminal_core` is loaded lazily by the backend: failing to initialize the
  PTY engine must not break unrelated plugin RPC methods.
- Sessions persist while the plugin stays loaded, not across a Decky restart,
  reinstallation, or operating-system reboot. This is intentional.


## Decky sandbox import path

The Decky plugin loader executes `main.py` using Python
`importlib.util.spec_from_file_location` in a separate sandbox process.
It adds `DECKY_PLUGIN_DIR/py_modules` but **not** the plugin directory itself
to `sys.path`. Therefore `main.py` registers its own resolved directory
before importing `hub_settings` and `terminal_core`. The isolated-loader
regression test in `tests/test_decky_loader.py` reproduces this behavior
using an interpreter started outside the project directory.


## Hardware crash protection (0.4.14)

On a Lenovo Legion Go S, an interactive PTY view showed a Python traceback
containing Unifideck paths and was followed by a Steam UI restart. This
is not sufficient to attribute the crash to Unifideck. As a precaution,
the Decky terminal adapter no longer mounts xterm or calls the backend,
and backend `terminal_start` refuses requests even from old cached UIs.
This is an intentional temporary capability reduction. Restore only after
the regression can be reproduced and isolated under safe test conditions.


## Standalone Linux app (0.5.0)

- `desktop/main.cjs`: Electron host with a strictly limited IPC API, navigation blocked, popups disabled, Node integration disabled, sandbox enabled.
- `desktop/preload.cjs`: isolated API bridge, no direct Node access in the UI.
- `desktop/ui/`: controller-friendly SteamOS-style settings layout independent of Decky and Steam.
- `desktop/lib/platform.cjs`: Linux distribution / Flatpak / AppImage detection.
- `desktop/lib/install.cjs`: atomic user-only AppImage installation with a desktop entry.
- `desktop/lib/files.cjs`: read-only file listing confined to the home directory after resolving symbolic links.
- `desktop/tests/`: unit tests for installation, path containment and platform detection.
- The independent UI ships as an AppImage and a local Flatpak bundle.
- Flatpak installation is handled by KDE Discover; there is no unverified shell installation script or elevated privilege request.
- Optional Steam/Decky adapters are future integrations. Do not claim automatic Steam library registration, installed external plugins, or shell execution.

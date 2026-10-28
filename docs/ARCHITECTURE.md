# Architecture (proposal)

SteamOS-Hub aims to offer a single setup experience for SteamOS gaming mode tools. This is a design scaffold, not a functioning Decky plugin.

## Components

- **Decky adapter (planned):** integration with the existing Decky Loader; avoid replacing Decky initially.
- **Launcher UI (planned):** controller-friendly hub with tiles for Games, Terminal, Tabs and Settings.
- **Modules (planned):** independent feature implementations with explicit permissions and lifecycle.
- **Game store adapter (planned):** GOG first, then Epic and Amazon; expose Linux/Windows build choice only when supported.

## Important constraints

- Steam library's native tabs are not a supported extension API. TabMaster integration and feasibility must be investigated before promising a new native tab.
- Running a terminal in gaming mode requires careful session handling, command confirmation, and no blanket root privileges.
- Existing projects must not be vendored until license, attribution and compatibility review is complete.
- Never collect or store store-account passwords in this repository; use supported authentication flows.

## Proposed milestones

1. Audit Decky Loader, TabMaster, and Unifideck APIs/licenses.
2. Build minimal controller-friendly hub with a safe backend bridge.
3. Add optional module registry and installer.
4. Implement GOG Linux/Windows installer selection with real availability checks.
5. Prototype tabs/library integration and terminal with permission boundaries.


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

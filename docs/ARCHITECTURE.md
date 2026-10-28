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

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

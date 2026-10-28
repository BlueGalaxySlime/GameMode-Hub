# Third-party notices

## TabMaster — GPL-3.0

Original project: **TabMaster**, Travis Lane (Tormak) and contributors.
Upstream code: https://github.com/Tormak9970/TabMaster
Original file: `src/patches/LibraryPatch.tsx`.
License: **GNU General Public License, version 3** (see `LICENSE`).

SteamHub's `src/modules/tab-manager/LibraryIntegration.tsx` **adapts TabMaster's
SteamOS library interception technique**. Changes include SteamHub-specific
tab models, an independent enable/disable lifecycle, conservative TabMaster
conflict handling, a SteamHub native library tab, and basic collection filters.
SteamHub is not an official TabMaster release and is not endorsed by its authors.

The adapted work is distributed under GPL-3.0. The complete, modifiable source
is provided in the SteamHub repository:
https://github.com/BlueGalaxySlime/SteamOS-Hub

Preserve this attribution and the copyright notices when redistributing
or adapting the integration. Consult the upstream repository for any
individual files carrying additional or different copyright/license notices.

The library integration has not yet been validated on real SteamOS hardware;
this development branch must not be presented as a stable TabMaster replacement.


## xterm.js and FitAddon — MIT

Terminal rendering uses the upstream packages `@xterm/xterm` and
`@xterm/addon-fit`, maintained by the xterm.js contributors.
Upstream: https://github.com/xtermjs/xterm.js
License: MIT, copyright xterm.js contributors and applicable earlier authors.
The bundled JS retains upstream licenses through package distribution.
`src/modules/terminal/terminalStyles.ts` adapts portions of xterm.js's
MIT-licensed default stylesheet. Include upstream license text in any
redistribution of copied or modified stylesheet code.

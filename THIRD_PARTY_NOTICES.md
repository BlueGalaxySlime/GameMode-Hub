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

### Full xterm.js MIT license

Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)
Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)
Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


## Desktop Apps (Decky) — GPL-3.0

Reference project: **decky-desktop-apps**, allmazz and contributors.
Upstream: https://github.com/allmazz/decky-desktop-apps
License: **GNU General Public License, version 3**.

GameMode Hub's Pulpit uses a separately styled file-manager-like interface
and implements application discovery from XDG .desktop entries. Steam shortcut
creation, launch and cleanup follow the upstream approach, adapted to this
project's service and settings. GameMode Hub remains GPL-3.0-only and is
not an official release of the Desktop Apps plugin.

The XDG Desktop Entry and Trash formats are public freedesktop.org standards:
https://specifications.freedesktop.org/
No third-party Trash implementation is bundled.

## UniFiDeck — external Decky integration (read-only)

Project: UniFiDeck, mubaraknumann and contributors.
Upstream: https://github.com/mubaraknumann/unifideck
License: GPL-3.0-or-later (the project's published license).

GameMode Hub invokes only UniFiDeck's status-check backend route via Decky
Loader and displays sanitized per-store connection states. Authentication,
storefront access, secrets and logout remain exclusively in UniFiDeck.
No UniFiDeck auth code or credential files are bundled or copied.

## External integrations and platform (no plugin implementation copied)

- Decky Loader / @decky/ui: SteamDeckHomebrew and contributors — native
  SteamOS UI and backend APIs. https://github.com/SteamDeckHomebrew/decky-loader
  (Decky Loader repository: GPL-2.0). APIs are imported rather than copied.
- Decky Manager: Ciphay — external file manager integration, not copied.
  https://github.com/Ciphay/Decky-File-Manager (BSD-3-Clause).
- SteamHub's PTY engine is independently implemented and does not copy
  the Decky Terminal plugin implementation.


## Decky Terminal keyboard integration — BSD 3-Clause

We adapt the technique of opening the native SteamOS keyboard by clicking an
offscreen Decky `TextField`'s native input. The original implementation is from
Decky Terminal, Alex4386 and decky-terminal contributors.
Source: https://github.com/Alex4386/decky-terminal
License: BSD 3-Clause (copyright (c) 2023–2025, Alex4386 and
decky-terminal contributors; original copyright (c) 2022–2023,
Steam Deck Homebrew). The terminal's PTY engine remains independent.

Copyright (c) 2023-2025, Alex4386 and decky-terminal contributors
Original Copyright (c) 2022-2023, Steam Deck Homebrew
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## ProtonDB — data source (ODbL / DbCL)

Data and compatibility tiers come from ProtonDB, https://www.protondb.com.
The dataset is licensed under the Open Database License (ODbL 1.0):
https://opendatacommons.org/licenses/odbl/1.0/
Individual contents are licensed under the Database Contents License (DbCL):
https://opendatacommons.org/licenses/dbcl/1.0/

GameMode Hub requests only a single game summary when asked by the user,
caches bounded metadata locally and links to the source. No bulk dataset
is bundled or redistributed with the plugin. ProtonDB names and trademarks
belong to their respective owners.

ProtonDB Badges for Decky (OMGDuke; later bschelst) was studied as a reference:
https://github.com/OMGDuke/protondb-decky
https://github.com/bschelst/protondb-decky
Source projects carry GPL licensing. No badge graphics, modified Steam UI
patches or source code from those plugins have been copied.

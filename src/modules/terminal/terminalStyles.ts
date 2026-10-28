/** Minimal xterm.js DOM styles. Derived from xterm.js MIT stylesheet.
 * https://github.com/xtermjs/xterm.js (copyright xterm.js contributors).
 * The complete upstream MIT license is referenced in THIRD_PARTY_NOTICES.md.
 */
const CSS = `
.steamhub-terminal { box-sizing: border-box; background: #111923; border-radius: 6px; overflow: hidden; }
.steamhub-terminal .xterm { position: relative; cursor: text; user-select: none; -webkit-user-select: none; height: 100%; }
.steamhub-terminal .xterm:focus { outline: none; }
.steamhub-terminal .xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
.steamhub-terminal .xterm .xterm-helper-textarea { position: absolute; opacity: 0; left: -9999em; top: 0; padding: 0; margin: 0; border: 0; width: 0; height: 0; white-space: nowrap; overflow: hidden; resize: none; }
.steamhub-terminal .xterm .composition-view { background: #000; color: #fff; display: none; position: absolute; white-space: nowrap; z-index: 1; }
.steamhub-terminal .xterm .composition-view.active { display: block; }
.steamhub-terminal .xterm .xterm-viewport { background-color: #111923; position: absolute; overflow-y: auto; cursor: default; inset: 0; }
.steamhub-terminal .xterm .xterm-screen { position: relative; }
.steamhub-terminal .xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
.steamhub-terminal .xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; }
.steamhub-terminal .xterm .xterm-accessibility, .steamhub-terminal .xterm .xterm-message { position: absolute; inset: 0; pointer-events: none; color: transparent; z-index: 10; }
.steamhub-terminal .xterm .xterm-accessibility-tree { white-space: pre; font-family: monospace; }
.steamhub-terminal .xterm .xterm-accessibility-tree > div { transform-origin: left; width: fit-content; }
.steamhub-terminal .xterm .live-region { position: absolute; left: -9999px; height: 1px; width: 1px; overflow: hidden; }
.steamhub-terminal .xterm .xterm-decoration-container .xterm-decoration { position: absolute; z-index: 6; }
.steamhub-terminal .xterm .xterm-decoration-top-layer { z-index: 7; }
.steamhub-terminal .xterm .xterm-decoration-overview-ruler { position: absolute; top: 0; right: 0; pointer-events: none; }
.steamhub-terminal .xterm .xterm-scroll-area { visibility: hidden; }
`;
export function ensureTerminalStyles() {
  const id = "steamhub-xterm-style";
  if (document.getElementById(id)) return;
  const node = document.createElement("style");
  node.id = id;
  node.textContent = CSS;
  document.head.appendChild(node);
}

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("src/core/desktopLaunchProfile.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const scope = { exports: {} };
vm.runInNewContext(compiled, scope);
const { desktopLaunchProfile } = scope.exports;

test("system profile does not alter command or display resolution", () => {
  const app = { bin: "/usr/bin/flatpak", cmd: "run org.mozilla.firefox", flatpak: true };
  assert.deepEqual(
    JSON.parse(JSON.stringify(desktopLaunchProfile(app))),
    { bin: "/usr/bin/flatpak", cmd: "run org.mozilla.firefox" }
  );
});

test("compact Flatpak scales only the app inside its sandbox", () => {
  const result = desktopLaunchProfile({
    bin: "/usr/bin/flatpak", cmd: "run --branch=stable org.mozilla.firefox", flatpak: true
  }, "compact");
  assert.equal(result.bin, "/usr/bin/flatpak");
  assert.match(result.cmd, /run --env=GDK_SCALE=1 --env=GDK_DPI_SCALE=0.85/);
  assert.match(result.cmd, /--branch=stable org.mozilla.firefox$/);
  assert.doesNotMatch(result.cmd, /gamescope|xrandr|--force-resolution/);
});

test("non-Flatpak compact mode uses no shell and quotes executable", () => {
  const result = desktopLaunchProfile({
    bin: "/opt/My App/start", cmd: "--data test", flatpak: false
  }, "compact");
  assert.equal(result.bin, "/usr/bin/env");
  assert.match(result.cmd, /QT_SCALE_FACTOR=0.85/);
  assert.match(result.cmd, /"\/opt\/My App\/start" --data test$/);
});

test("Desktop has Steam Input selection for permanent shortcuts", () => {
  const page = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
  const launcher = fs.readFileSync("src/hub/desktopLaunch.ts", "utf8");
  assert.match(page, /Okno w Gaming Mode/);
  assert.match(page, /Sterowanie padem/);
  assert.match(page, /Steam Input: szablony \/ inne gry/);
  assert.match(page, /createSteamDesktopShortcut\(app, stored.apps\[app.id\]/);
  assert.match(launcher, /ShowControllerConfigurator\(appId\)/);
  assert.doesNotMatch(launcher, /SetAppResolutionOverride/);
});

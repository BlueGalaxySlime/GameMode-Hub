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

test("legacy compact profile no longer shrinks Flatpak graphical interface", () => {
  const app = { bin: "/usr/bin/flatpak", cmd: "run --branch=stable org.mozilla.firefox", flatpak: true };
  for (const profile of ["system", "compact"]) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(desktopLaunchProfile(app, profile))),
      { bin: app.bin, cmd: app.cmd }
    );
  }
  assert.doesNotMatch(source, /GDK_DPI_SCALE=0\.85|QT_SCALE_FACTOR=0\.85/);
});

test("legacy compact profile no longer wraps executables", () => {
  const app = { bin: "/opt/My App/start", cmd: "--data test", flatpak: false };
  assert.deepEqual(
    JSON.parse(JSON.stringify(desktopLaunchProfile(app, "compact"))),
    { bin: app.bin, cmd: app.cmd }
  );
});

test("native display override is per Steam shortcut, not global display", () => {
  const launcher = fs.readFileSync("src/hub/desktopLaunch.ts", "utf8");
  assert.match(launcher, /SetAppResolutionOverride\(appId, profile === "native" \? "Native" : "Default"\)/);
  assert.doesNotMatch(launcher, /gamescope|xrandr|--force-resolution/);
});

test("Desktop retains Steam Input controls, with reversible native display option", () => {
  const page = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
  const launcher = fs.readFileSync("src/hub/desktopLaunch.ts", "utf8");
  assert.match(page, /Dopasowanie obrazu w Gaming Mode/);
  assert.match(page, /Automatyczne \(Steam\)/);
  assert.match(page, /Natywna rozdzielczość aplikacji \(test\)/);
  assert.match(page, /Sterowanie padem/);
  assert.match(page, /Steam Input: szablony \/ inne gry/);
  assert.match(page, /createSteamDesktopShortcut\(app, "system", stored.apps\[app.id\]/);
  assert.match(launcher, /ShowControllerConfigurator\(appId\)/);
});

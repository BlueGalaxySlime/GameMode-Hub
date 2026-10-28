"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const page = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
const launch = fs.readFileSync("src/hub/desktopLaunch.ts", "utf8");
const hub = fs.readFileSync("src/hub/HubPage.tsx", "utf8");
const backend = fs.readFileSync("main.py", "utf8");
const bundle = fs.readFileSync("scripts/package.py", "utf8");

test("Pulpit uses native Files-style list and tag navigation, not Desktop Apps UI", () => {
  assert.ok(hub.includes("content: <DesktopPage />"));
  assert.ok(page.includes('aria-label="Kategorie aplikacji — lewo i prawo"'));
  assert.ok(page.includes('flow-children="row"'));
  assert.ok(page.includes('flow-children="column"'));
  assert.ok(page.includes('height: "min(54vh, 540px)"'));
  assert.ok(page.includes('Widok: lista'));
  assert.ok(page.includes('onOptionsButton={event => openAppMenu(app, event.currentTarget ?? window)}'));
  assert.ok(!page.includes("FaEllipsis"));
  assert.ok(!page.includes('cancelText="Wstecz"'));
});
test("apps are detected by backend and launched using Steam shortcuts", () => {
  for (const rpc of ["desktop_list_apps", "desktop_get_state", "desktop_set_setting",
    "desktop_remember_temporary", "desktop_forget_temporary"]) {
    assert.ok(backend.includes("async def " + rpc + "("), rpc);
  }
  assert.ok(bundle.includes('"desktop_apps.py"'));
  assert.ok(page.includes('createSteamDesktopShortcut(app)'));
  assert.ok(launch.includes('SteamClient.Apps.RunGame('));
  assert.ok(launch.includes('RegisterForAppLifetimeNotifications'));
  assert.ok(page.includes('removeSteamDesktopShortcut(temporary.appId)'));
});
test("Pulpit has favorite, Steam library and hide actions; no Open duplicate", () => {
  assert.ok(page.includes('"Dodaj do ulubionych"'));
  assert.ok(page.includes('"Dodaj do biblioteki Steam"'));
  assert.ok(page.includes('"Ukryj"'));
  assert.ok(page.includes('onOKActionDescription="Uruchom"'));
  assert.ok(!page.includes('>Otwórz</MenuItem>'));
});

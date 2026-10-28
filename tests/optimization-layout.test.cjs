const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");

const page = fs.readFileSync("src/hub/UiPage.tsx", "utf8");
const cards = fs.readFileSync("src/modules/tab-manager/TabManagerModule.tsx", "utf8");
const collections = fs.readFileSync("src/modules/collection-manager/CollectionsModule.tsx", "utf8");
const options = fs.readFileSync("src/hub/HubOptionsPage.tsx", "utf8");

test("Optimization uses the same simple settings sections as Hub Options", () => {
  assert.ok(options.includes("<DialogControlsSectionHeader>Terminal</DialogControlsSectionHeader>"));
  assert.ok(page.includes("<DialogControlsSectionHeader>Gaming Mode</DialogControlsSectionHeader>"));
  assert.ok(cards.includes("<DialogControlsSectionHeader>Karty</DialogControlsSectionHeader>"));
  assert.ok(collections.includes("<DialogControlsSectionHeader>Kolekcje</DialogControlsSectionHeader>"));
  assert.ok(!page.includes("<Focusable"));
  assert.ok(!page.includes('setGamingModule('));
  assert.ok(!page.includes('setCategory('));
  assert.ok(!page.includes('>Ogólne</DialogButton>'));
  assert.ok(!page.includes('>Obraz</DialogButton>'));
  assert.ok(!page.includes('>Konsola</DialogButton>'));
});

test("All Optimization modules are visible in one page without nested tabs", () => {
  assert.ok(page.includes('<TabManagerModule />'));
  assert.ok(page.includes('<CollectionsModule />'));
  assert.ok(page.includes('<ProtonDBPage />'));
  assert.ok(page.includes('saveGameUi({ ...settings, [key]: value })'));
  const editor = fs.readFileSync("src/modules/tab-manager/LibraryCardsEditor.tsx", "utf8");
  const integration = fs.readFileSync("src/modules/tab-manager/LibraryIntegration.tsx", "utf8");
  assert.ok(editor.includes('save_tab_definitions'));
  assert.ok(integration.includes('createElement(LibraryCardsEditor)'));
  assert.ok(integration.includes('title: "+"'));
  assert.ok(!cards.includes('save_tab_definitions'));
  assert.ok(page.includes('<LibraryBackupSection />'));
  assert.ok(collections.includes('save_hub_collections'));
});

test("No empty placeholder subpages or duplicate helper text", () => {
  assert.ok(!page.includes("Przyszłe ustawienia"));
  assert.ok(!page.includes('label="Źródła gier"'));
  assert.ok(!cards.includes('label="Karty biblioteki"'));
  assert.ok(!cards.includes("Dodaj kartę"));
  assert.ok(!cards.includes("Nazwa nowej karty"));
  assert.ok(!collections.includes('label="Kolekcje Huba"'));
});

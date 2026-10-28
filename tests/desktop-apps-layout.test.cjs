"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const page = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
const launch = fs.readFileSync("src/hub/desktopLaunch.ts", "utf8");
const hub = fs.readFileSync("src/hub/HubPage.tsx", "utf8");
const backend = fs.readFileSync("main.py", "utf8");
const bundle = fs.readFileSync("scripts/package.py", "utf8");

test("Pulpit uses the Files layout with a search bar and category breadcrumb", () => {
  assert.ok(hub.includes("content: <DesktopPage />"));
  assert.ok(page.includes('aria-label="Ścieżka pulpitu"'));
  assert.ok(!page.includes('flow-children="row"')); // No redundant focusable category row.
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

test("A on the search bar edits text through the shared SteamOS keyboard input", () => {
  assert.ok(page.includes('import { HubTextInput } from "./HubTextInput"'));
  assert.ok(page.includes('const [search, setSearch] = useHubSessionState("desktop.search", "")'));
  assert.ok(page.includes('const [editingSearch, setEditingSearch] = useState(false)'));
  assert.ok(page.includes('<HubTextInput value={search} focusOnMount'));
  assert.ok(page.includes('aria-label="Szukaj aplikacji"'));
  assert.ok(page.includes('onClick={() => setEditingSearch(true)}'));
  assert.ok(page.includes('onOKActionDescription="Szukaj"'));
  assert.ok(page.includes('onChange={event => {'));
  assert.ok(page.includes('setSearch(event.target.value)'));
  assert.ok(page.includes('finishSearch()'));
  assert.ok(page.includes('searchControlRef.current?.querySelector<HTMLElement>'));
  assert.ok(page.includes('filterDesktopApps(apps, stored.apps, category, search, sortMode)'));
  assert.ok(!page.includes('aria-label="Kategorie aplikacji — lewo i prawo"'));
});

test("Y on the search bar opens View and Sort submenus, without a category button row", () => {
  assert.ok(page.includes('onOptionsActionDescription="Opcje pulpitu"'));
  assert.ok(page.includes('openDesktopMenu(event.currentTarget ?? window)'));
  assert.ok(page.includes('<MenuGroup label="Widok">'));
  assert.ok(page.includes('<MenuGroup label="Sortowanie">'));
  for (const label of ["Wszystkie", "Ulubione", "Flatpak", "Systemowe", "Ukryte",
    "Nazwa A–Z", "Nazwa Z–A", "Ostatnio uruchamiane"]) {
    assert.ok(page.includes('label: "' + label + '"'), label);
  }
  assert.ok(page.includes('selected={category === item.key}'));
  assert.ok(page.includes('selected={sortMode === item.key}'));
  assert.ok(page.includes('onSelected={() => changeCategory(item.key)}'));
  assert.ok(page.includes('const [sortMode, setSortMode] = useHubSessionState<DesktopSort>'));
  assert.ok(page.includes('const activeCategory = categories.find('));
  assert.ok(!page.includes('onClick={() => changeCategory("all")}'));
  assert.ok(page.includes('<span>Pulpit</span><span aria-hidden="true">›</span>'));
  assert.ok(page.includes('aria-label="Ścieżka pulpitu"'));
  assert.ok(!page.includes('cancelText="Wstecz"'));
});

test("sidebar starts with Pulpit / Pliki / Terminal; terminal settings live in Hub Options", () => {
  const order = [...hub.matchAll(/title: "(Pulpit|Pliki|Terminal|Konta|Dodatki|Opcje Huba)"/g)].map(m => m[1]);
  assert.deepEqual(order, ["Pulpit", "Pliki", "Terminal", "Konta", "Dodatki", "Opcje Huba"]);
  assert.ok(!hub.includes('title: "Opcje terminala"'));
  assert.ok(hub.includes('setTerminalFontSize={setTerminalFontSize}'));
  const options = fs.readFileSync("src/hub/HubOptionsPage.tsx", "utf8");
  assert.ok(options.includes('label="Rozmiar czcionki terminala"'));
  assert.ok(options.includes('showValue onChange={setTerminalFontSize}'));
  assert.ok(options.includes('Uruchamianie terminala pozostaje wyłączone'));
  const terminal = fs.readFileSync("src/hub/DeckyTerminalAdapter.tsx", "utf8");
  assert.ok(!terminal.includes("TerminalOptionsPage"));
});

test("credits acknowledge Desktop Apps and XDG standards", () => {
  const credits = fs.readFileSync("src/hub/CreditsPage.tsx", "utf8");
  const notices = fs.readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
  assert.ok(credits.includes('project: "Desktop Apps (Decky)"'));
  assert.ok(credits.includes('source: "github.com/allmazz/decky-desktop-apps"'));
  assert.ok(credits.includes('project: "freedesktop.org / XDG"'));
  assert.ok(credits.includes('<GamepadScrollArea>'));
  assert.ok(notices.includes('https://github.com/allmazz/decky-desktop-apps'));
});

test("B on search consumes SteamOS cancel before it can leave the Hub", () => {
  assert.ok(page.includes('onCancelActionDescription={editingSearch ? "Zamknij wyszukiwanie" : "Wróć do wyszukiwania"}'));
  assert.ok(page.includes('onCancelButton={event => {'));
  assert.ok(page.includes('event.preventDefault();'));
  assert.ok(page.includes('event.stopPropagation();'));
  assert.ok(page.includes('finishSearch();'));
  assert.ok(page.includes('searchControlRef.current?.querySelector<HTMLElement>'));
});

test("all View categories have their own selectable menu actions and visible labels", () => {
  assert.ok(page.includes('onSelected={() => changeCategory(item.key)}'));
  assert.ok(page.includes('onClick={() => changeCategory(item.key)}'));
  assert.ok(page.includes('selected={category === item.key}'));
  assert.ok(page.includes('const activeCategory = categories.find('));
  assert.ok(page.includes('{activeCategory}'));
  assert.ok(!page.includes('<DialogButton onClick={() => changeCategory("all")}'));
  assert.ok(!page.includes('aria-label="Kategorie aplikacji — lewo i prawo"'));
});

test("all sidebar tabs form one contiguous controller-navigation list", () => {
  const pages = hub.split("  const pages = [", 2)[1].split("\n  ];", 1)[0];
  assert.ok(!pages.includes('"separator" as const'));
  const names = [...pages.matchAll(/title: "(Pulpit|Pliki|Terminal|Konta|Dodatki|Opcje Huba|Aktualizacje|Pobieranie|Podziękowania|Zgłoszenia)"/g)]
    .map(match => match[1]);
  assert.deepEqual(names, ["Pulpit", "Pliki", "Terminal", "Konta", "Dodatki",
    "Opcje Huba", "Aktualizacje", "Pobieranie", "Podziękowania", "Zgłoszenia"]);
});

test("B is captured on Desktop also outside search edit mode", () => {
  assert.ok(page.includes('onCancelButton={event => {'));
  assert.ok(page.includes('backInDesktop();'));
  assert.ok(page.includes('if (editingSearch) {'));
  assert.ok(page.includes('finishSearch();'));
  assert.ok(page.includes('changeCategory("all")'));
  assert.ok(page.includes('focusSearchBar();'));
  assert.ok(page.includes('event.stopPropagation();'));
});

test("Konta is fourth tab without mock login buttons", () => {
  const tabs = [...hub.matchAll(/title: "(Pulpit|Pliki|Terminal|Konta|Dodatki)"/g)]
    .map(match => match[1]);
  assert.deepEqual(tabs, ["Pulpit", "Pliki", "Terminal", "Konta", "Dodatki"]);
  assert.ok(hub.includes('content: <AccountsPage installed={installed} />'));
  const source = fs.readFileSync("src/hub/AccountsPage.tsx", "utf8");
  assert.ok(source.includes("Stan sklepów pobierany bezpośrednio z UniFiDeck"));
  assert.ok(source.includes('readUnifideckStatuses()'));
  assert.ok(source.includes('label={item.name}'));
  assert.ok(source.includes("<GamepadScrollArea>"));
  assert.ok(!source.includes("oauth"));
});

test("Accounts uses UniFiDeck read-only RPC, never reads credential files", () => {
  const bridge = fs.readFileSync("src/hub/unifideckBridge.ts", "utf8");
  assert.ok(bridge.includes('backend.callable("loader/call_plugin_method")'));
  assert.ok(bridge.includes('invoke("Unifideck", "check_store_status")'));
  assert.ok(!bridge.includes('invoke("Unifideck", "store_auth")'));
  assert.ok(!bridge.includes('.config/legendary'));
  assert.ok(!bridge.includes('gog_token.json'));
  assert.ok(bridge.includes('candidate.available'));
  assert.ok(hub.includes('content: <AccountsPage installed={installed} />'));
});

test("Desktop View exposes readable auto rules and per-app category overrides", () => {
  assert.ok(page.includes('<MenuGroup label="Reguły widoku">'));
  assert.ok(page.includes('Pokaż reguły'));
  assert.ok(page.includes('showModal('));
  assert.ok(page.includes('<MenuGroup label="Przypisanie">'));
  assert.ok(page.includes('assignCategory(app, item.key)'));
  assert.ok(page.includes('effectiveDesktopCategory(app, stored.apps[app.id])'));
  assert.ok(page.includes('Reguły: .desktop / Flatpak + własne przypisania'));
  const rules = fs.readFileSync("src/hub/DesktopRulesDialog.tsx", "utf8");
  assert.ok(rules.includes('wpisem X-Flatpak'));
  assert.ok(rules.includes('Ręcznie przypisane: {overridden}'));
});

test("Desktop Rules View offers confirmation before reset to auto", () => {
  const rules = fs.readFileSync("src/hub/DesktopRulesDialog.tsx", "utf8");
  const data = fs.readFileSync("desktop_apps.py", "utf8");
  assert.ok(page.includes('Resetuj do automatycznych'));
  assert.ok(page.includes('onSelected={openResetRules}'));
  assert.ok(page.includes('disabled={busy || !!working || !hasManualOverrides}'));
  assert.ok(page.includes('desktop_reset_categories'));
  assert.ok(page.includes('setStored(result.state)'));
  assert.ok(rules.includes('Resetować reguły widoku?'));
  assert.ok(rules.includes('onConfirm()'));
  assert.ok(rules.includes('Anuluj'));
  assert.ok(backend.includes('async def desktop_reset_categories('));
  assert.ok(data.includes('def reset_desktop_categories():'));
});

test("Reset modal uses left/right gamepad navigation and opens only once", () => {
  const rules = fs.readFileSync("src/hub/DesktopRulesDialog.tsx", "utf8");
  assert.ok(rules.includes('<Focusable flow-children="row"'));
  assert.ok(rules.includes('navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}'));
  assert.ok(rules.includes('<DialogButton preferredFocus'));
  assert.ok(page.includes('const rulesModalOpenRef = useRef(false)'));
  assert.ok(page.includes('if (rulesModalOpenRef.current) return;'));
  assert.ok(page.includes('dialog.ClosedPromise.finally('));
  assert.ok(page.includes('<MenuItem onSelected={openRules}>'));
  assert.ok(page.includes('onSelected={openResetRules}>'));
  assert.ok(!page.includes('onClick={openRules}'));
  assert.ok(!page.includes('onClick={openResetRules}'));
});

test("Flatpak actions are in Desktop Y menus; system update remains read-only", () => {
  const flatpak = fs.readFileSync("src/hub/FlatpakManagerDialog.tsx", "utf8");
  const backend = fs.readFileSync("flatpak_manager.py", "utf8");
  assert.ok(page.includes('<MenuGroup label="Flatpak">'));
  assert.ok(page.includes('openFlatpakManager(app.id)'));
  assert.ok(page.includes('Sprawdź aktualizacje wszystkich'));
  assert.ok(page.includes('FlatpakManagerDialog'));
  assert.ok(flatpak.includes('item.installation === "user"'));
  assert.ok(flatpak.includes('Potwierdź aktualizację'));
  assert.ok(backend.includes('["--user", "update"'));
  assert.ok(backend.includes('subprocess.run('));
  assert.ok(backend.includes('APP_ID.fullmatch(app_id)'));
  assert.ok(!backend.includes('shell=True'));
  assert.ok(hub.includes('title: "Zgłoszenia"'));
  assert.ok(hub.includes('<ReportsPage />'));
});

test("Reports uses compact inline placeholders and multiline bounded description", () => {
  const reports = fs.readFileSync("src/hub/ReportsPage.tsx", "utf8");
  const inputs = fs.readFileSync("src/hub/HubTextInput.tsx", "utf8");
  assert.ok(reports.includes('<HubTextInput value={title}'));
  assert.ok(reports.includes('placeholder="Tytuł błędu'));
  assert.ok(reports.includes('<HubTextArea value={detail} rows={5} maxLength={MAX_TEXT}'));
  assert.ok(reports.includes('placeholder="Opis błędu:'));
  assert.ok(reports.includes('const MAX_TEXT = 1200;'));
  assert.ok(reports.includes('{detail.length} / {MAX_TEXT} znaków'));
  assert.ok(reports.includes('<Focusable flow-children="row"'));
  assert.ok(reports.includes('Zgłoś na GitHub'));
  assert.ok(reports.includes('Istniejące zgłoszenia'));
  assert.ok(!reports.includes('<Field '));
  assert.ok(!reports.includes('<DialogControlsSectionHeader'));
  assert.ok(inputs.includes('export function HubTextArea('));
  assert.ok(inputs.includes('<textarea {...fieldProps} autoFocus={focusOnMount}'));
  assert.ok(inputs.includes('inputMode={options.autoKeyboard ? "text" : "none"}'));
});


test("Report fields are native focusable Steam rows with A editing, B exiting", () => {
  const reports = fs.readFileSync("src/hub/ReportsPage.tsx", "utf8");
  const inputs = fs.readFileSync("src/hub/HubTextInput.tsx", "utf8");
  assert.ok(reports.includes('onOKActionDescription="Edytuj tytuł"'));
  assert.ok(reports.includes('onOKActionDescription="Edytuj opis"'));
  assert.ok(reports.includes('onClick={() => setEditingDetail(true)}'));
  assert.ok(reports.includes('finishTitle(event.key === "ArrowDown")'));
  assert.ok(reports.includes('onCancelButton={event => {'));
  assert.ok(reports.includes('restoreButtonFocus(detailRowRef.current)'));
  assert.ok(inputs.includes('background: "transparent"'));
  assert.ok(!inputs.slice(inputs.indexOf("export function HubTextArea(")).includes('"#333d50"'));
  assert.ok(!inputs.slice(inputs.indexOf("export function HubTextArea(")).includes('"#68748a"'));
  assert.ok(!inputs.slice(inputs.indexOf("export function HubTextArea(")).includes('borderRadius: 4'));
});
test("Flatpak checks display an accurate nonzero status and Y can update all user apps", () => {
  const flatpak = fs.readFileSync("src/hub/FlatpakManagerDialog.tsx", "utf8");
  const py = fs.readFileSync("flatpak_manager.py", "utf8");
  assert.ok(page.includes('void checkFlatpakUpdates();'));
  assert.ok(page.includes('Dostępne aktualizacje: '));
  assert.ok(page.includes('Brak aktualizacji'));
  assert.ok(page.includes('Nie udało się sprawdzić aktualizacji'));
  assert.ok(page.includes('onSelected={() => openFlatpakManager(undefined, true)}'));
  assert.ok(page.includes('Aktualizuj wszystkie (użytkownika)'));
  assert.ok(flatpak.includes('Potwierdź wszystkie'));
  assert.ok(flatpak.includes('onUpdated?.()'));
  assert.ok(backend.includes('async def flatpak_update_all_user('));
  assert.ok(py.includes('def flatpak_update_all_user():'));
  assert.ok(py.includes('["--user", "update", "--app"'));
});


test("Flatpak task does not lock modal and all user updates run in one process", () => {
  const dialog = fs.readFileSync("src/hub/FlatpakManagerDialog.tsx", "utf8");
  const svc = fs.readFileSync("flatpak_manager.py", "utf8");
  assert.ok(dialog.includes('onCancel={() => closeModal?.()}'));
  assert.ok(dialog.includes('<DialogButton onClick={() => closeModal?.()}>Zamknij</DialogButton>'));
  assert.ok(dialog.includes('enqueueFlatpakDownload(target, scope)'));
  assert.ok(dialog.includes('useDownloads()'));
  assert.ok(dialog.includes('Możesz zamknąć okno'));
  assert.ok(dialog.includes('task?.elapsed'));
  assert.ok(svc.includes('start_new_session=True'));
  assert.ok(svc.includes('os.killpg('));
  assert.ok(svc.includes('class FlatpakUpdateTask:'));
});

test("Downloads is a separate Decky/Hub screen backed by nonblocking queue", () => {
  const quick = fs.readFileSync("src/index.tsx", "utf8");
  const manager = fs.readFileSync("downloads_manager.py", "utf8");
  const downloads = fs.readFileSync("src/hub/DownloadsPage.tsx", "utf8");
  const flatpak = fs.readFileSync("src/hub/FlatpakManagerDialog.tsx", "utf8");
  assert.ok(quick.includes('<PanelSection title="Pobieranie">'));
  assert.ok(quick.includes('routerHook.addRoute(HUB_ROUTE + "/downloads"'));
  assert.ok(hub.includes('title: "Pobieranie"'));
  assert.ok(hub.includes('<DownloadsPage />'));
  assert.ok(downloads.includes('useDownloads()'));
  assert.ok(downloads.includes('Anuluj zadanie'));
  assert.ok(flatpak.includes('enqueueFlatpakDownload(target, scope)'));
  assert.ok(flatpak.includes('Możesz zamknąć okno'));
  assert.ok(manager.includes('class DownloadManager:'));
  assert.ok(manager.includes('STATE_FILE = Path.home()'));
  assert.ok(manager.includes('threading.Thread('));
  assert.ok(manager.includes('if existing is not None:'));
  assert.ok(bundle.includes('"downloads_manager.py"'));
});
 
test("System Firefox can be updated and bulk includes all installations", () => {
  const ui = fs.readFileSync("src/hub/FlatpakManagerDialog.tsx", "utf8");
  const backend = fs.readFileSync("flatpak_manager.py", "utf8");
  const queue = fs.readFileSync("downloads_manager.py", "utf8");
  assert.ok(ui.includes('Aktualizuj wszystkie dostępne ({total})'));
  assert.ok(ui.includes('Systemowe: {systemUpdates}'));
  assert.ok(ui.includes('scope: item.installation === "user" ? "user" : "system"'));
  assert.ok(ui.includes('enqueueFlatpakDownload(null, scope)'));
  assert.ok(backend.includes('args = ["flatpak", "--" + scope, "update"'));
  assert.ok(queue.includes('def enqueue_flatpak(self, target=None, scope="user")'));
});

test("B on Pulpit search remains inside Hub, with visible root feedback", () => {
  const source = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
  assert.ok(source.includes('const restoreSearchFocusRef = useRef(false)'));
  assert.ok(source.includes('restoreSearchFocusRef.current = true;'));
  assert.ok(source.includes('if (editingSearch || !restoreSearchFocusRef.current) return;'));
  assert.ok(source.includes('focusSearchBar();'));
  assert.ok(source.includes('navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}'));
  assert.ok(source.includes('GamepadButton.CANCEL'));
  assert.ok(source.includes('onCancelActionDescription="Wróć w Pulpicie"'));
  assert.ok(source.includes('onCancelButton={event => {'));
  assert.ok(source.includes('Jesteś w głównym widoku Pulpitu.'));
  assert.ok(source.includes('Wyczyszczono wyszukiwanie.'));
  assert.ok(source.includes("'button, [role=\"button\"]'"));
  assert.ok(!source.includes("'button, [role=\"button\"], [tabindex]'"));
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

const ui = fs.readFileSync("src/hub/FileManagerPage.tsx", "utf8");
const updater = fs.readFileSync("src/hub/UpdaterPage.tsx", "utf8");
const hubOptions = fs.readFileSync("src/hub/HubOptionsPage.tsx", "utf8");
const hubTextInput = fs.readFileSync("src/hub/HubTextInput.tsx", "utf8");
const terminalInput = fs.readFileSync("src/modules/terminal/TerminalView.tsx", "utf8");
const creditsPage = fs.readFileSync("src/hub/CreditsPage.tsx", "utf8");
const infoField = fs.readFileSync("src/hub/FocusableInfoField.tsx", "utf8");
const infoScroll = fs.readFileSync("src/hub/GamepadScrollArea.tsx", "utf8");
const hubPage = fs.readFileSync("src/hub/HubPage.tsx", "utf8");
const desktopPage = fs.readFileSync("src/hub/DesktopPage.tsx", "utf8");
const createFolder = fs.readFileSync("src/hub/CreateFolderDialog.tsx", "utf8");
const trashDialog = fs.readFileSync("src/hub/TrashDialogs.tsx", "utf8");
const backend = fs.readFileSync("main.py", "utf8");
const packageCode = fs.readFileSync("scripts/package.py", "utf8");
const terminalPage = fs.readFileSync("src/hub/DeckyTerminalAdapter.tsx", "utf8");
const compiled = ts.transpileModule(fs.readFileSync("src/core/filePath.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { breadcrumbs } = context.exports;

test("Y on the focused file or address opens native SteamOS context menu", () => {
  assert.ok(ui.includes("showContextMenu("));
  assert.ok(ui.includes("ref={filesFocusRef}"));
  assert.ok(ui.includes("openFocusedFilesMenu(event.target ?? window)"));
  assert.ok(ui.includes("data-file-pane={pane}"));
  assert.ok(ui.includes("data-file-path={entry.path}"));
  assert.ok(ui.includes('onOptionsActionDescription="Opcje plików"'));
  assert.ok(ui.includes("openBrowserMenu(event.currentTarget ?? window)"));
  assert.ok(ui.includes('onOptionsActionDescription="Opcje"'));
  assert.ok(ui.includes("openFileMenu(entry, event.currentTarget ?? window, pane);"));
  assert.ok(ui.includes("function openFocusedFilesMenu(parent: EventTarget)"));
  assert.ok(ui.includes("event.stopPropagation();"));
  assert.ok(ui.includes("<Menu label={entry.name}"));
  assert.ok(ui.includes('clipboardAction(entry, "copy")'));
  assert.ok(ui.includes('clipboardAction(entry, "move")'));
  assert.ok(ui.includes("onSecondaryButton={event => {")); // X returns to address; Y still owns context menus.
});

test("file options are in native right-hand submenus, not inline controls", () => {
  assert.ok(ui.includes('<Menu label="Opcje plików"'));
  for (const label of ["Pokaż ukryte", "Podziel ekran", "Sortowanie"]) {
    assert.ok(ui.includes('<MenuGroup label="' + label + '"'), label);
  }
  assert.ok(ui.includes("Nowy folder..."));
  assert.ok(ui.includes("changeHidden(show: boolean)"));
  assert.ok(ui.includes("changeSplitTree(enabled: boolean)"));
  assert.ok(ui.includes("selected={sortMode === option.data}"));
  for (const name of ["Nazwa A–Z", "Nazwa Z–A", "Typ A–Z", "Typ Z–A", "Rozmiar ↑", "Data ↓"]) {
    assert.ok(ui.includes(name));
  }
  assert.ok(!ui.includes("<Dropdown"));
  assert.ok(!ui.includes(">Zmień</DialogButton>"));
  assert.ok(!ui.includes(">Kopiuj</DialogButton>"));
  assert.ok(!ui.includes(">Przenieś</DialogButton>"));
});

test("path can be edited with A, while status strip is read only", () => {
  assert.ok(ui.includes('onOKActionDescription="Edytuj ścieżkę"'));
  assert.ok(ui.includes("setSelectingPath(false); setEditingPath(true);"));
  assert.ok(ui.includes('aria-label="Edytuj ścieżkę katalogu"'));
  assert.ok(ui.includes('event.key === "Enter"'));
  assert.ok(ui.includes('event.key === "Escape"'));
  assert.ok(ui.includes('<HubTextInput value={pathDraft}'));
  assert.ok(!ui.includes('>Przejdź</DialogButton>'));
  assert.ok(ui.includes('onCancelActionDescription={multiSelect ? "Zakończ zaznaczanie"'));
  assert.ok(ui.includes('aria-label="Stan przeglądarki plików"'));
  assert.ok(ui.includes("Sortowanie: {sortOptions.find("));
  assert.ok(ui.includes('Ukryte: {hidden ? "widoczne" : "niewidoczne"}'));
  assert.ok(!ui.includes(">Odśwież</DialogButton>"));
  const parts = breadcrumbs("/home/deck/Downloads/sub", [{name:"Dom",path:"/home/deck"}]);
  assert.deepEqual(Array.from(parts, x => x.path), ["/home/deck", "/home/deck/Downloads", "/home/deck/Downloads/sub"]);
  assert.equal(breadcrumbs("/etc", [{name:"Dom",path:"/home/deck"}]).length, 0);
});

test("controller navigation has explicit horizontal and vertical groups", () => {
  assert.ok(ui.includes('flow-children="row"'));
  assert.ok(ui.includes('flow-children="column"'));
  assert.ok(ui.includes("NavEntryPositionPreferences.MAINTAIN_X"));
  assert.ok(ui.includes("NavEntryPositionPreferences.MAINTAIN_Y"));
  assert.ok(ui.includes('flow-children={splitTree ? "row" : "column"}'));
});

test("split file browser uses two independent complete lists and one address bar", () => {
  const address = ui.indexOf('onOKActionDescription="Edytuj ścieżkę"');
  const status = ui.indexOf('aria-label="Stan przeglądarki plików"');
  const tags = ui.indexOf('aria-label="Tagi lokalizacji — lewo i prawo"');
  const browser = ui.indexOf("Two complete file panels, one shared white address bar");
  assert.ok(status >= 0 && tags > status && address > tags && browser > address);
  assert.equal(ui.split('onOKActionDescription="Edytuj ścieżkę"').length - 1, 1);
  assert.ok(ui.includes("const splitTree = options.splitFileTree"));
  assert.ok(ui.includes('const [rightPage, setRightPage]'));
  assert.ok(ui.includes('flexDirection: splitTree ? "row" : "column"'));
  assert.ok(ui.includes('folder.items.map(entry =>'));
  assert.ok(ui.includes('onMouseEnter={() => activatePane(pane)}'));
  assert.ok(ui.includes('onGamepadFocus={() => activatePane(pane)}'));
  assert.ok(ui.includes('Podział: {splitTree ? "WŁ." : "WYŁ."}'));
  assert.ok(ui.includes('height: "min(54vh, 540px)"'));
  assert.ok(ui.includes('pane === "left" ? "files.treeScrollTop" : "files.listScrollTop"'));
  assert.ok(ui.includes("<ParentDirectoryRow parent={folder.parent}"));
  assert.ok(!ui.includes("page.items.filter(entry => !entry.directory)"));
});

test("file view session survives changing Hub tabs", () => {
  for (const key of ["files.page", "files.pathDraft", "files.editingPath", "files.hidden",
    "files.sortMode", "files.selected", "files.clipboard", "files.action", "files.name"]) {
    assert.ok(ui.includes(key), key);
  }
  assert.ok(ui.includes('if (!page) void load(null, hidden, 0, sortBy, descending, "left");'));
});

test("split option appears only in Files, not universal Hub options", () => {
  assert.ok(ui.includes('<MenuGroup label="Podziel ekran"'));
  assert.ok(!hubOptions.includes('label="Podział drzewa plików"'));
  assert.ok(!hubOptions.includes("splitFileTree"));
  assert.ok(hubOptions.includes('label="Zachowuj stan kart"'));
  assert.ok(hubOptions.includes('label="Automatycznie pokazuj klawiaturę"'));
  assert.ok(hubOptions.includes('update("autoKeyboard", value)'));
});

test("updater opens native channel/version menus without inline version list", () => {
  assert.ok(updater.includes("openChannelMenu(event.currentTarget ?? window)"));
  assert.ok(updater.includes("openVersionsMenu(event.currentTarget ?? window)"));
  assert.ok(updater.includes('<Menu label="Kanał aktualizacji"'));
  assert.ok(updater.includes('<Menu label="Wybierz wersję"'));
  assert.ok(updater.includes("selected={selected?.version === entry.version}"));
  assert.ok(updater.includes("confirmDowngrade"));
  assert.ok(!updater.includes('entries.map(entry =>\n            <DialogButton'));
});

test("one Hub keyboard preference switches between Steam and physical input", () => {
  assert.ok(hubOptions.includes('value={options.autoKeyboard}'));
  assert.ok(hubTextInput.includes('getHubPreferences, subscribeHubPreferences'));
  assert.ok(hubTextInput.includes('options.autoKeyboard'));
  assert.ok(hubTextInput.includes('TextEditControls'));
  assert.ok(hubTextInput.includes('onMenuActionDescription="Edycja tekstu"'));
  assert.ok(hubTextInput.includes('<TextField {...fieldProps}'));
  assert.ok(hubTextInput.includes('inputMode="none"'));
  assert.ok(ui.includes('import { HubTextInput } from "./HubTextInput"'));
  assert.ok(terminalInput.includes('keyboardOptions.autoKeyboard ? "text" : "none"'));
});

test("favourites and multi-selection live in Steam menus; B cancels selection", () => {
  assert.ok(ui.includes('MenuGroup label="Ulubione"'));
  assert.ok(ui.includes('get_favorite_folders'));
  assert.ok(ui.includes('set_favorite_folders'));
  assert.ok(ui.includes('MenuItem onSelected={() => startMultiSelect(entry)}'));
  assert.ok(ui.includes('markedPaths.includes(entry.path)'));
  assert.ok(ui.includes('toggleMarked(entry.path)'));
  assert.ok(ui.includes('pasteMany(clipboard.paths'));
  assert.ok(ui.includes('Wklej do folderu'));
  assert.ok(ui.includes('exitMultiSelect()'));
});

test("directory changes retain focus inside the file tree instead of jumping to tabs", () => {
  assert.ok(ui.includes('const pendingDirectoryFocus = useRef<"left" | "right" | null>(null)'));
  assert.ok(ui.includes("useLayoutEffect(() => {"));
  assert.ok(ui.includes('target.focus({ preventScroll: true })'));
  assert.ok(ui.includes('navigateDirectory(entry.path, pane)'));
  assert.ok(ui.includes('navigateDirectory(parent, pane)'));
  assert.ok(ui.includes('data-file-entry'));
  assert.ok(ui.includes('data-parent-row'));
  assert.ok(ui.includes('disabled={entry.symlink || locked.current}'));
});

test("tag navigation is horizontal, the address sits directly above a full-width single tree", () => {
  assert.ok(ui.includes('aria-label="Tagi lokalizacji — lewo i prawo"'));
  assert.ok(ui.includes('flow-children="row"'));
  assert.ok(ui.includes('flexDirection: "row", flexWrap: "nowrap"'));
  assert.ok(ui.includes('overflowX: "auto", overflowY: "hidden"'));
  assert.ok(ui.includes('width: splitTree ? "50%" : "100%"'));
  assert.ok(ui.includes('width: "100%", minWidth: 0, height: "min(54vh, 540px)"'));
  assert.equal(ui.split('onOKActionDescription="Edytuj ścieżkę"').length - 1, 1);
});

test("plain text information is never collapsed in credits, desktop, or terminal", () => {
  assert.ok(creditsPage.includes("focusable highlightOnFocus"));
  assert.ok(creditsPage.includes("<GamepadScrollArea>"));
  assert.ok(creditsPage.includes("credit.authors +"));
  assert.ok(!creditsPage.includes("setExpanded"));
  assert.ok(!creditsPage.includes("Rozwiń opis"));
  assert.ok(infoField.includes('import { Field } from "@decky/ui"'));
  assert.ok(infoField.includes("focusable highlightOnFocus"));
  assert.ok(!infoField.includes("useState"));
  assert.ok(!infoField.includes("DialogButton"));
  assert.ok(hubPage.includes("content: <DesktopPage />"));
  assert.ok(desktopPage.includes('overflowY: "auto"'));
  assert.ok(terminalPage.includes("<GamepadScrollArea>"));
});

test("gamepad focus scrolls through full plain text instead of opening submenus", () => {
  assert.ok(infoScroll.includes('<Focusable flow-children="column"'));
  assert.ok(infoScroll.includes("onFocusCapture={event =>"));
  assert.ok(infoScroll.includes('target.scrollIntoView({ block: "nearest"'));
  assert.ok(infoScroll.includes('overflowY: "auto"'));
  assert.ok(infoScroll.includes('maxHeight: "min(66vh, 620px)"'));
});

test("favourites show one short row per folder; A opens, Right offers only remove", () => {
  assert.ok(ui.includes('<MenuGroup label="Ulubione">'));
  assert.ok(ui.includes('>Dodaj</MenuItem>'));
  assert.ok(ui.includes('function favoriteLabel(path: string)'));
  assert.ok(ui.includes('onSelected={() => { void load(path, hidden); }}'));
  assert.ok(ui.includes('onMoveRight={() => openRemoveFavoriteMenu(path)}'));
  assert.ok(ui.includes('<Menu label={favoriteLabel(path)}>'));
  assert.ok(ui.includes('changeFavorites(favorites.filter(p => p !== path))'));
  assert.ok(ui.includes('>\n          Usuń\n        </MenuItem>'));
  assert.ok(!ui.includes('Otwórz zakładkę:'));
  assert.ok(!ui.includes('Usuń zakładkę'));
  assert.ok(!ui.includes('Dodaj zakładkę bieżącego folderu'));
  assert.ok(!ui.includes('unlink('));
  assert.ok(!ui.includes('rmdir('));
});

test("file menus have no redundant Back label; new folder opens keyboard modal", () => {
  assert.ok(!ui.includes('cancelText="Wstecz"'));
  assert.ok(ui.includes('<MenuItem disabled={!currentPage} onSelected={openCreateFolderDialog}>'));
  assert.ok(ui.includes('showModal(<CreateFolderDialog folder={folder}'));
  assert.ok(!ui.includes('action === "folder" &&'));
  assert.ok(createFolder.includes("<ModalRoot"));
  assert.ok(createFolder.includes('focusOnMount aria-label="Nazwa nowego folderu"'));
  assert.ok(createFolder.includes('event.key === "Enter"'));
  assert.ok(createFolder.includes('makeFolder(folder, proposed)'));
  assert.ok(createFolder.includes('closeModal?.()'));
});

test("Y offers a reversible Trash action with explicit confirmation and recovery", () => {
  assert.ok(ui.includes('<MenuItem onSelected={() => confirmTrash(entry)}>Przenieś do Kosza</MenuItem>'));
  assert.ok(ui.includes('<MenuItem onSelected={openTrashDialog}>Kosz</MenuItem>'));
  assert.ok(ui.includes("showModal("));
  assert.ok(ui.includes("<ConfirmTrashDialog path={target}"));
  assert.ok(ui.includes("<TrashListDialog onRestored="));
  assert.ok(trashDialog.includes("<ModalRoot"));
  assert.ok(trashDialog.includes("Przenieść do Kosza?"));
  assert.ok(trashDialog.includes("Folder zostanie przeniesiony wraz z całą zawartością."));
  assert.ok(trashDialog.includes("B anuluje."));
  assert.ok(trashDialog.includes("closeModal?.()"));
  assert.ok(trashDialog.includes("files_trash_restore"));
  assert.ok(!trashDialog.includes("Usuń na zawsze"));
  for (const name of ["files_trash", "files_trash_list", "files_trash_restore"]) {
    assert.ok(backend.includes("async def " + name + "("));
  }
  assert.ok(packageCode.includes('"trash_manager.py"'));
});

test("X returns focus to the address bar without navigating, B keeps parent/Back", () => {
  assert.ok(ui.includes('onSecondaryActionDescription="Pasek adresu"'));
  assert.ok(ui.includes('onSecondaryButton={event => {'));
  assert.ok(ui.includes('returnToAddressBar();'));
  assert.ok(ui.includes('function returnToAddressBar()'));
  assert.ok(ui.includes('function focusAddressBar()'));
  assert.ok(ui.includes('pendingAddressFocus.current = true;'));
  assert.ok(ui.includes('addressControlRef.current?.querySelector<HTMLElement>'));
  assert.ok(ui.includes('ref={addressControlRef}'));
  assert.ok(ui.includes('function backInFiles(): boolean'));
  assert.ok(ui.includes('navigateDirectory(currentPage.parent, currentPane)'));
  assert.ok(ui.includes('if (event.defaultPrevented || !backInFiles()) return;'));
  assert.ok(ui.includes('onCancelActionDescription={multiSelect ?'));
  assert.ok(ui.includes('currentPage?.parent ? "Katalog wyżej" : "Wstecz"'));
});

test("Local Wi-Fi transfer is available via Y in Files without root credentials", () => {
  const transferUi = fs.readFileSync("src/hub/TransferDialog.tsx", "utf8");
  const backend = fs.readFileSync("main.py", "utf8");
  const transport = fs.readFileSync("lan_transfer.py", "utf8");
  assert.ok(ui.includes('onSelected={() => openTransferDialog()}>Transfer Wi-Fi...'));
  assert.ok(ui.includes('onSelected={() => openTransferDialog(entry.path)}'));
  assert.ok(ui.includes('Udostępnij przez Wi-Fi'));
  assert.ok(transferUi.includes('transfer_start'));
  assert.ok(transferUi.includes('transfer_stop'));
  assert.ok(transferUi.includes('transfer_share'));
  assert.ok(transferUi.includes('transfer_status'));
  assert.ok(transferUi.includes('<ModalRoot'));
  assert.ok(transferUi.includes('Kod parowania'));
  assert.ok(transferUi.includes('HTTP nie jest szyfrowane'));
  for (const method of ['transfer_status', 'transfer_start', 'transfer_stop', 'transfer_share']) {
    assert.ok(backend.includes('async def ' + method + '('));
  }
  assert.ok(transport.includes('if os.geteuid() == 0:'));
  assert.ok(transport.includes('ThreadingHTTPServer'));
  assert.ok(transport.includes('os.O_NOFOLLOW'));
  assert.ok(transport.includes('os.link(tmp, dest, follow_symlinks=False)'));
  assert.ok(transport.includes('SESSION_SECONDS = 30 * 60'));
  assert.ok(!transport.includes('subprocess.'));
  assert.ok(!transport.includes('sudo '));
  const pkg = fs.readFileSync('scripts/package.py', 'utf8');
  assert.ok(pkg.includes('"lan_transfer.py"'));
});

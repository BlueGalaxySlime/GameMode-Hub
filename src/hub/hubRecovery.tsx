import { Navigation, Menu, MenuGroup, MenuItem, showContextMenu } from "@decky/ui";

// Recovery is independent of the active page or Python background workers.
// Only the Hub view is remounted. Flatpak downloads continue in the backend.
let revision = 0;
const listeners = new Set<() => void>();

export function getHubRevision() { return revision; }
export function subscribeHubRevision(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
export function refreshHubView() {
  revision += 1;
  listeners.forEach(listener => listener());
}
export function closeHubView() {
  // Do not stop the plugin backend: this would interrupt active downloads.
  Navigation.Navigate("/library");
  Navigation.CloseSideMenus();
}
export function openHubRecoveryMenu(anchor: EventTarget) {
  showContextMenu(
    <Menu label="GameMode Hub">
      <MenuGroup label="Awaryjne">
        <MenuItem onSelected={refreshHubView}>Odśwież interfejs Huba</MenuItem>
        <MenuItem onSelected={closeHubView}>Zamknij Hub</MenuItem>
      </MenuGroup>
    </Menu>,
    anchor,
    { bPreferPopLeft: true, bShiftToFitWindow: true }
  );
}

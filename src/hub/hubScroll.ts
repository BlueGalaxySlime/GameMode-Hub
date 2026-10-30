/**
 * Optional wheel/PageUp/PageDown scrolling within the currently visible Hub
 * page. Steam Input must map the physical right trackpad to wheel events:
 * Decky's web UI cannot change a device's Steam Input configuration.
 *
 * D-pad and left pad remain owned by Steam's directional focus navigation.
 * No controller polling, pointer capture, fake key presses, or focus changes.
 */
const PAGE_SELECTOR = "[data-hub-scroll-page]";
const MARKED_SELECTOR = "[data-hub-scroll-container]";
const SCROLLABLE_STYLES = ["auto", "scroll", "overlay"];

export function normalizedScrollDelta(value: number, mode: number, viewport: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = mode === 1 ? 36 : mode === 2 ? Math.max(100, viewport * 0.85) : 1;
  const distance = value * factor;
  return Math.max(-900, Math.min(900, distance));
}

function canScroll(node: HTMLElement, direction: number): boolean {
  if (!direction || node.clientHeight < 16 || node.scrollHeight <= node.clientHeight + 2) return false;
  const overflow = window.getComputedStyle(node).overflowY;
  if (!SCROLLABLE_STYLES.includes(overflow)) return false;
  const position = node.scrollTop;
  return direction < 0 ? position > 1 :
    position + node.clientHeight < node.scrollHeight - 1;
}

function visible(node: HTMLElement): boolean {
  if (!node.getClientRects().length || node.closest('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden";
}

function currentPage(shell: HTMLElement, target: EventTarget | null): HTMLElement | null {
  const pages = Array.from(shell.querySelectorAll<HTMLElement>(PAGE_SELECTOR)).filter(visible);
  if (!pages.length) return null;
  if (target instanceof Node) {
    const targeted = pages.find(page => page.contains(target));
    if (targeted) return targeted;
  }
  const focused = document.activeElement;
  return pages.find(page => focused && page.contains(focused)) ?? pages[0];
}

function ancestorCandidates(node: Node | null, page: HTMLElement): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  let current = node instanceof HTMLElement ? node : node?.parentElement;
  while (current && page.contains(current)) {
    candidates.push(current);
    current = current.parentElement;
  }
  return candidates;
}

/** Pick one scrolling area; prefer the file pane or list containing focus. */
export function findHubScrollTarget(
  page: HTMLElement, origin: Node | null, distance: number
): HTMLElement | null {
  const focus = document.activeElement;
  const candidates: HTMLElement[] = [];
  const add = (item: HTMLElement | null | undefined) => {
    if (item && !candidates.includes(item)) candidates.push(item);
  };
  const focusInPage = focus instanceof Node && page.contains(focus);

  // If the right-pad mouse cursor happens to be inside the content, scroll it.
  if (origin && page.contains(origin))
    for (const item of ancestorCandidates(origin, page)) add(item);

  // The D-pad may have selected a different pane. Do not move its focus.
  if (focusInPage)
    for (const item of ancestorCandidates(focus, page)) add(item);

  // Explicit primary areas: Desktop app list, file list/tree, readable pages.
  for (const item of page.querySelectorAll<HTMLElement>(MARKED_SELECTOR)) add(item);

  // Existing nested scroll areas (including terminal viewport or Decky UI).
  for (const item of page.querySelectorAll<HTMLElement>('[style*="overflow"]')) add(item);
  add(page);

  // Fallback for Decky's own page scroller, outside the route content wrapper.
  let parent = page.parentElement;
  const shell = page.closest<HTMLElement>("[data-hub-shell]");
  while (parent && shell && shell.contains(parent)) {
    add(parent);
    if (parent === shell) break;
    parent = parent.parentElement;
  }

  return candidates.find(node => canScroll(node, distance)) ?? null;
}

function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const element = target.closest<HTMLElement>('input, textarea, select, [contenteditable="true"], [role="textbox"]');
  return !!element;
}

/**
 * Bind once for the Hub route. A routed event is cancelled ONLY after an
 * actual scrollable page was found; otherwise SteamOS receives it normally.
 */
export function enableHubScroll(shell: HTMLElement): () => void {
  const route = (target: EventTarget | null, distance: number): boolean => {
    const page = currentPage(shell, target);
    if (!page || !distance) return false;
    const node = target instanceof Node ? target : null;
    const scrollTarget = findHubScrollTarget(page, node, distance);
    if (!scrollTarget) return false;
    scrollTarget.scrollBy({ top: distance, behavior: "auto" });
    return true;
  };

  const insideShell = (target: EventTarget | null) =>
    target instanceof Node && shell.contains(target);

  const onWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || !insideShell(event.target))
      return;
    // Never hijack SteamOS popovers or external dialogs.
    if (event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="menu"]')) return;
    const page = currentPage(shell, event.target);
    if (!page) return;
    const amount = normalizedScrollDelta(event.deltaY, event.deltaMode, page.clientHeight);
    if (route(event.target, amount)) event.preventDefault();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey ||
        (event.key !== "PageDown" && event.key !== "PageUp") ||
        !insideShell(event.target) || isEditing(event.target) ||
        isEditing(document.activeElement)) return;
    if (event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="menu"]')) return;
    const page = currentPage(shell, event.target);
    if (!page) return;
    const amount = (event.key === "PageDown" ? 1 : -1) * Math.max(120, page.clientHeight * 0.8);
    if (route(event.target, amount)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("keydown", onKey, true);
  return () => {
    window.removeEventListener("wheel", onWheel, true);
    window.removeEventListener("keydown", onKey, true);
  };
}

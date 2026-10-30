import type { ReactNode } from "react";
import { Focusable } from "@decky/ui";

/**
 * Scroll text-only pages using actual Steam controller focus targets.
 * Descendant Field components set focusable; the focused text row is scrolled
 * into view without turning informational text into an expandable button.
 */
export function GamepadScrollArea({ children }: { children: ReactNode }) {
  return <Focusable flow-children="column" data-hub-scroll-container="reading"
    aria-label="Przewijana treść — krzyżak góra/dół"
    onFocusCapture={event => {
      const target = event.target as HTMLElement;
      if (target !== event.currentTarget) {
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
    }}
    style={{ display: "flex", flexDirection: "column", gap: 7,
      width: "100%", minWidth: 0, maxHeight: "min(66vh, 620px)",
      overflowY: "auto", overscrollBehavior: "contain", paddingBottom: 28 }}>
    {children}
  </Focusable>;
}

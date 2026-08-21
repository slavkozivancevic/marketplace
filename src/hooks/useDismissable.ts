"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Closes an open, non-modal disclosure the three ways people actually expect:
 * a click/tap outside it, the Escape key, and a navigation.
 *
 * Written for the header mobile menus, which previously closed only via their
 * own X button or by tapping one of their links - so tapping the page behind
 * them, or going Back, left the panel hanging open over the content.
 *
 * Returns two refs. BOTH must be attached: `triggerRef` on the button that
 * toggles the panel and `panelRef` on the panel itself. The trigger has to be
 * excluded explicitly, otherwise its own tap counts as "outside", the panel
 * closes on pointerdown, and the button's click handler immediately toggles it
 * back open - the menu would appear to ignore the button entirely.
 *
 * `pointerdown` rather than `click`: it fires before focus moves and before any
 * click handler inside the page runs, so the panel is already closing while the
 * tap does whatever else it was going to do. It also covers touch and pen
 * without a separate touch listener.
 *
 * Radix-based overlays (Dialog, Sheet, Popover, DropdownMenu, Select) already
 * do all of this themselves - this is only for hand-rolled panels.
 */
export function useDismissable<
  TTrigger extends HTMLElement = HTMLElement,
  TPanel extends HTMLElement = HTMLElement,
>(open: boolean, onDismiss: () => void) {
  const triggerRef = useRef<TTrigger>(null);
  const panelRef = useRef<TPanel>(null);

  // Keep the latest callback without making it an effect dependency, so a
  // parent that passes an inline arrow doesn't detach and reattach the
  // listeners on every render.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onDismissRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismissRef.current();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Close on navigation. The menus already close from their links' onClick, but
  // that never runs for a Back/Forward gesture or any navigation started
  // elsewhere, which used to leave the panel open on the new page.
  const pathname = usePathname();
  useEffect(() => {
    if (open) onDismissRef.current();
    // Only react to the path changing - including `open` here would slam the
    // panel shut on the same tick it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return { triggerRef, panelRef };
}

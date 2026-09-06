"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * True when the event landed inside a Radix popper layer (DropdownMenu,
 * Popover, Select, Tooltip content).
 *
 * Those layers are portaled to `document.body`, so a panel that only asks
 * "does my own subtree contain the target?" counts every click inside its own
 * popover as a click OUTSIDE itself. That is the bug this guards: opening the
 * preferences popover from inside the mobile menu and picking a theme closed
 * the menu underneath while the popover stayed open, left dangling over the
 * page with its trigger collapsed away.
 *
 * Deliberately narrow. Popper layers are the ones a panel opens as part of
 * itself; portaled MODAL surfaces (a Sheet, a Dialog, Clerk's sign-in modal)
 * are a different interaction that legitimately replaces the panel, and they
 * keep dismissing it.
 */
function isInsidePopperLayer(target: Node): boolean {
  const el = target instanceof Element ? target : target.parentElement;
  return !!el?.closest("[data-radix-popper-content-wrapper]");
}

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
 * do all of this themselves - this is only for hand-rolled panels. A panel may
 * still CONTAIN one: see `isInsidePopperLayer` above for why a click inside a
 * portaled popover must not count as a click outside the panel hosting it,
 * and why Escape there dismisses the popover before it dismisses the panel.
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
      if (isInsidePopperLayer(target)) return;
      onDismissRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Dismiss one layer at a time. With a popover open inside the panel,
      // Escape belongs to the popover (Radix closes it on the same keydown);
      // closing the panel out from under it in the same stroke collapses two
      // surfaces at once, which reads as the menu vanishing at a stray press.
      // The next Escape finds no popper layer and closes the panel.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      onDismissRef.current();
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

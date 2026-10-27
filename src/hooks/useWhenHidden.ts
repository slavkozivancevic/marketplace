import { useEffect, useRef, type RefObject } from "react";

function isShown(el: Element): boolean {
  return typeof el.checkVisibility === "function"
    ? el.checkVisibility()
    : el.getClientRects().length > 0;
}

/**
 * Hides, in place, the popup an open trigger at or under `el` points to.
 * Radix and Clerk both name it in the trigger's `aria-controls`.
 */
function hideOpenPopup(el: Element): void {
  const trigger = el.matches('[aria-expanded="true"][aria-controls]')
    ? el
    : el.querySelector('[aria-expanded="true"][aria-controls]');
  const id = trigger?.getAttribute("aria-controls");
  const popup = id ? document.getElementById(id) : null;
  if (popup) popup.style.display = "none";
}

/**
 * Calls `onHidden` when the element goes from rendered to `display: none` -
 * itself or through an ancestor.
 *
 * The headers render their popup triggers twice and hide one copy per
 * breakpoint with CSS (`hidden xl:flex` / `xl:hidden`). Resizing across the
 * breakpoint with a popup open hides its trigger, the anchor's rect collapses
 * to 0,0 and the popup jumps to the top-left corner of the screen. Closing it
 * is the fix: the visible copy is the one to open next.
 *
 * Closing alone still flashed it in the corner: the state update paints a
 * frame later, and Radix then plays its exit animation where the popup now
 * sits. So the popup open under `el` is first hidden directly in the DOM. A
 * ResizeObserver runs after layout and before paint, so the frame that hides
 * the trigger never shows the popup at 0,0. `display: none` also makes Radix's
 * Presence skip the exit animation and unmount at once.
 */
export function useWhenHidden(
  ref: RefObject<Element | null>,
  onHidden: () => void,
): void {
  const callback = useRef(onHidden);
  useEffect(() => {
    callback.current = onHidden;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let shown = isShown(el);
    const observer = new ResizeObserver(() => {
      const now = isShown(el);
      if (shown && !now) {
        hideOpenPopup(el);
        callback.current();
      }
      shown = now;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

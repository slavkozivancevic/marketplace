import { LONG_PRESS_SLOP_PX } from "@/lib/longPress";

/** How far a bubble must be dragged right for the release to reply - as on WhatsApp, about a quarter of a phone's width of thumb travel. */
export const SWIPE_REPLY_PX = 64;
/** How far the bubble follows the finger at most. */
export const SWIPE_MAX_PX = 96;

/**
 * Which way a touch drag on a bubble has committed. It stays "pending" until
 * the finger has moved past the same slop the long press tolerates, then
 * locks once: rightward and more sideways than up or down is a swipe-to-reply,
 * anything else is the thread scrolling (or a leftward drag, which does
 * nothing) and stays that way for the rest of the touch. Vertical wins ties -
 * a scroll must never turn into a reply.
 */
export type SwipeAxis = "pending" | "reply" | "none";

export function swipeAxis(dx: number, dy: number, current: SwipeAxis): SwipeAxis {
  if (current !== "pending") return current;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= LONG_PRESS_SLOP_PX) return "pending";
  return dx > 0 && Math.abs(dx) > Math.abs(dy) ? "reply" : "none";
}

/** How far the bubble is drawn to the right for a drag of `dx`. */
export function swipeOffset(dx: number): number {
  return Math.min(Math.max(dx, 0), SWIPE_MAX_PX);
}

/** Whether releasing a reply drag at `dx` replies. */
export function swipeFires(dx: number): boolean {
  return dx >= SWIPE_REPLY_PX;
}

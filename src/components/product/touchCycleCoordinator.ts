"use client";

// Keeps at most one HoverImageCycler cycling at a time on touch devices.
//
// Touch has no hover, so the finger stands in for the cursor: a card starts
// cycling when a touch on it turns into a swipe (see HoverImageCycler), and
// keeps going until it has shown every image once. Because the cycle outlives
// the touch that started it, two cards could otherwise animate at once - so
// starting one here hard-stops whichever was running before, exactly like
// moving a mouse from one card to another.

type Claim = { el: Element; stop: () => void };

let active: Claim | null = null;

/**
 * Makes `el` the single actively cycling card, stopping the previous one.
 * `stop` must halt the cycle immediately and reset the card to its first
 * image.
 */
export function claimTouchCycle(el: Element, stop: () => void) {
  if (active && active.el !== el) active.stop();
  active = { el, stop };
}

/** Gives up the slot (cycle finished, or the card unmounted). */
export function releaseTouchCycle(el: Element) {
  if (active?.el === el) active = null;
}

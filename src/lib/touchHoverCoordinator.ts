"use client";

// Keeps at most one card in the touch-hover state at a time.
//
// Touch has no hover, so the finger stands in for the cursor: a card activates
// when a touch on it turns into a small swipe (see `useTouchHover`), and stays
// active until it has finished whatever it was showing - an image cycle's lap,
// or a hold timeout for a card that just reveals a label. Because that state
// outlives the touch that started it, two cards could otherwise be lit at once
// - so claiming here hard-stops whichever was active before, exactly like
// moving a mouse from one card to another.
//
// This began as `touchCycleCoordinator` next to `HoverImageCycler`. It now
// coordinates department cards and the home collage as well as product cards,
// i.e. two or more features genuinely share it, which is what earns it a place
// in `src/lib/`.

type Claim = { el: Element; stop: () => void };

let active: Claim | null = null;

/**
 * Makes `el` the single active card, stopping the previous one. `stop` must
 * clear that card's active state immediately (and, for a cycling card, reset
 * it to its first image).
 */
export function claimTouchHover(el: Element, stop: () => void) {
  if (active && active.el !== el) active.stop();
  active = { el, stop };
}

/** Gives up the slot (state finished, or the card unmounted). */
export function releaseTouchHover(el: Element) {
  if (active?.el === el) active = null;
}

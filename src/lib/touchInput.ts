"use client";

/**
 * Marks `<html data-input-touch>` while the person is actually using a finger.
 *
 * `(hover: hover) and (pointer: fine)` describes what a device CAN do, not what
 * is being used, and it is not even reliable about that: Chrome's device
 * emulation can keep reporting a fine pointer while dispatching touch events,
 * and a 2-in-1 laptop reports hover even when its owner is touching the screen.
 * Gating hover styling on that query alone is what made the touch effects look
 * broken - `:hover` LATCHES on a touch screen (it applies on tap and is not
 * cleared until something else is touched), so the reveal appeared when the
 * finger lifted instead of when it moved.
 *
 * This watches the input itself: any touch sets the flag, and a genuine mouse
 * movement clears it. The `hoverable:` variant in globals.css combines the two,
 * so a hover rule needs both a hover-capable device AND no finger in play.
 *
 * The synthetic `mousemove` a browser fires right after a tap is the whole
 * difficulty: it is indistinguishable from a real one by type alone, so the
 * flag ignores mouse movement for a short window after the last touch.
 */

const TOUCH_SETTLE_MS = 700;

let installed = false;
let lastTouchAt = 0;

/**
 * Records that a finger is in play, and arms the watcher that will clear it
 * again once a real mouse moves.
 *
 * Called straight from the touch handler rather than from an effect: the flag
 * has to be set on the FIRST touch, and an effect is one thing that may not
 * have run yet - React can make a tree interactive through event delegation
 * before its effects have flushed.
 */
export function markTouchInput() {
  if (typeof document === "undefined") return;
  lastTouchAt = Date.now();
  document.documentElement.dataset.inputTouch = "true";
  ensureTouchInputTracking();
}

function ensureTouchInputTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const root = document.documentElement;

  const onTouch = () => {
    lastTouchAt = Date.now();
    root.dataset.inputTouch = "true";
  };

  const onMouseMove = () => {
    // Ignore the synthetic mouse events a tap produces; only movement that
    // arrives well clear of the last touch counts as a real pointer.
    if (Date.now() - lastTouchAt < TOUCH_SETTLE_MS) return;
    delete root.dataset.inputTouch;
  };

  window.addEventListener("touchstart", onTouch, { passive: true, capture: true });
  window.addEventListener("mousemove", onMouseMove, { passive: true, capture: true });
}

/** True while a finger is the input in play - the moment a hover rule must not fire. */
export function isTouchInput() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.inputTouch === "true";
}

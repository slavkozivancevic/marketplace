"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSupportsHover } from "@/hooks/useSupportsHover";
import { claimTouchHover, releaseTouchHover } from "@/lib/touchHoverCoordinator";
import { markTouchInput } from "@/lib/touchInput";

/**
 * The touch counterpart of `:hover`.
 *
 * A touch screen has no hover, so anything a card reveals on hover - a vignette
 * lifting, a label appearing, an image cycle starting - is unreachable there.
 * The fix is NOT to show those things permanently on touch: at rest a touch
 * device must look exactly like a desktop one. The fix is to give hover a
 * gesture: a touch that turns into a small swipe (typically the page scroll the
 * user was starting anyway) activates the card under the finger, the same way
 * moving a mouse onto it does. A clean tap is left alone, so it still opens the
 * link.
 *
 * The gesture, the 8px threshold and the one-card-at-a-time rule all come from
 * `HoverImageCycler`, which has been doing this for the product grid; this hook
 * is that logic lifted out so department cards and the home collage share one
 * implementation instead of growing their own.
 *
 * On a device that DOES hover, this returns `active: false` and inert handlers.
 * Nothing about mouse behaviour changes - `group-hover:` keeps doing all of it.
 */

/**
 * How far a finger must travel before a touch counts as a swipe, not a tap.
 *
 * Small on purpose. The browser only forwards `touchmove` until it decides the
 * gesture is a page scroll; from that moment it sends `touchcancel` and stops.
 * With a larger threshold the one or two moves that arrive first are often
 * still under it, and the card never activates at all.
 */
export const TOUCH_ACTIVATE_PX = 6;

/** Default time a card stays lit after the finger lifts, when it has no cycle
 *  of its own to finish. Long enough to read a label, short enough that the
 *  page does not sit covered in half-open cards. */
const DEFAULT_HOLD_MS = 2600;

export interface UseTouchHoverOptions {
  /**
   * Milliseconds to stay active after the finger lifts. Omit it for a caller
   * that ends the state itself (an image cycle finishing its lap) and call
   * `deactivate` when that work is done.
   */
  holdMs?: number | null;
  /** Fires when the swipe activates the card. */
  onActivate?: () => void;
  /** Fires when it drops back to rest, however that happened. */
  onDeactivate?: () => void;
  /**
   * Fires the moment the finger lifts or the gesture is cancelled, whichever
   * route delivered it. For a caller that owns its own end condition and so
   * cannot rely on a React `onTouchEnd` reaching it.
   */
  onRelease?: () => void;
  /** Set false to opt out entirely (nothing to reveal on this card). */
  enabled?: boolean;
}

export interface UseTouchHover {
  /** True only on touch devices, only while the gesture holds it. */
  active: boolean;
  supportsHover: boolean;
  /** Spread onto the card element. */
  touchProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  /** Attach to the same element - the coordinator identifies cards by node. */
  containerRef: (el: HTMLElement | null) => void;
  /** Drop back to rest now (used by callers that own their own end condition). */
  deactivate: () => void;
}

/**
 * The attribute the card carries while the gesture holds it. Pair it with the
 * hover class at every call site -
 * `group-hover:opacity-0 group-data-[touch-active=true]:opacity-0` - so both
 * inputs drive the exact same result and the touch path can never drift into
 * a look of its own.
 *
 * Destructure the hook's result rather than reaching through it
 * (`touch.containerRef`): the lint rule that guards ref access during render
 * treats any member read on an object carrying a ref as a violation. The same
 * is true of `useDismissable` elsewhere in the app.
 */
export function touchActiveAttr(active: boolean) {
  return active ? ({ "data-touch-active": "true" } as const) : {};
}

export function useTouchHover({
  holdMs = DEFAULT_HOLD_MS,
  onActivate,
  onDeactivate,
  onRelease,
  enabled = true,
}: UseTouchHoverOptions = {}): UseTouchHover {
  const supportsHover = useSupportsHover();
  const [active, setActive] = useState(false);

  const elRef = useRef<HTMLElement | null>(null);
  // Where the current touch started, until it becomes a swipe or ends.
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callbacks through refs: the handlers below are memoised on the gesture
  // logic alone, so a caller passing inline closures cannot make them churn.
  const onActivateRef = useRef(onActivate);
  const onDeactivateRef = useRef(onDeactivate);
  const onReleaseRef = useRef(onRelease);
  useEffect(() => {
    onActivateRef.current = onActivate;
    onDeactivateRef.current = onDeactivate;
    onReleaseRef.current = onRelease;
  }, [onActivate, onDeactivate, onRelease]);

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const deactivate = useCallback(() => {
    clearHold();
    startRef.current = null;
    setActive((was) => {
      if (was) onDeactivateRef.current?.();
      return false;
    });
    if (elRef.current) releaseTouchHover(elRef.current);
  }, []);

  // Never leave the shared slot pointing at an unmounted card, and never leave
  // a hold timer running past it.
  useEffect(() => {
    return () => {
      clearHold();
      const el = elRef.current;
      if (el) releaseTouchHover(el);
    };
  }, []);

  const activate = useCallback(() => {
    clearHold();
    // Claiming stops whichever card was still lit - one at a time, exactly
    // like a cursor moving between cards.
    if (elRef.current) claimTouchHover(elRef.current, deactivate);
    setActive(true);
    onActivateRef.current?.();
  }, [deactivate]);

  /*
    NOT gated on `supportsHover`.

    A touch event only fires when something actually touched the screen, so
    listening for one costs a hover-capable device nothing. Gating it on the
    media query broke two real cases instead: a 2-in-1 laptop reports
    `hover: hover` and left the finger with no way to engage a card, and a
    browser emulating a phone can keep reporting a fine pointer, which made
    the gesture look broken under DevTools - the effect appearing only on
    release there was `:hover` latching after the tap, not this code running
    late.

    `supportsHover` is still exported, for callers that have a genuine mouse
    handler to suppress (see `HoverImageCycler`'s `mouseenter`).
  */
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      // Flag the input BEFORE anything paints, so the `hoverable:` variant
      // stops matching from this very first touch onward.
      markTouchInput();
      const touch = e.touches[0];
      startRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    [enabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      const touch = e.touches[0];
      if (!start || !touch) return;
      if (
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) <
        TOUCH_ACTIVATE_PX
      ) {
        return;
      }
      // Activate once per touch, not on every subsequent move.
      startRef.current = null;
      activate();
    },
    [activate],
  );

  // Lifting the finger does not cut the state short. A card with its own end
  // condition (an image cycle running out its lap) passes `holdMs: null` and
  // calls `deactivate` itself; everything else fades back after the hold, so a
  // quick swipe is enough to actually read what was revealed.
  const scheduleRelease = useCallback(() => {
    if (holdMs == null) return;
    clearHold();
    holdTimerRef.current = setTimeout(deactivate, holdMs);
  }, [holdMs, deactivate]);

  const onTouchEnd = useCallback(() => {
    startRef.current = null;
    onReleaseRef.current?.();
    scheduleRelease();
  }, [scheduleRelease]);

  /**
   * `touchcancel` means the browser has taken the gesture over to scroll the
   * page - which is to say the finger DID swipe. It also means no further
   * `touchmove` is coming, so if the threshold had not been crossed yet this
   * is the last chance to activate. Without this the card only ever lit up
   * once the finger lifted, and then only because `:hover` latches after a tap
   * on touch screens - the effect looked late because it was not this code
   * firing at all.
   */
  const onTouchCancel = useCallback(() => {
    if (startRef.current) {
      startRef.current = null;
      activate();
    }
    onReleaseRef.current?.();
    scheduleRelease();
  }, [activate, scheduleRelease]);

  /*
    The same four handlers, bound NATIVELY to the node as well as passed to
    React.

    React delivers touch events through one delegated listener on the root
    container, and that delegation is not always in place when it looks like it
    should be - a tree can be interactive through some paths while others have
    not been wired yet. The symptom was exact and repeatable: under Chrome's
    device emulation nothing happened during the swipe, and the reveal only
    appeared on release (which was `:hover` latching, not this code).

    Binding to the element itself removes React from that path entirely. Both
    routes call the same functions, and `startRef` makes a double delivery a
    no-op - whichever arrives first clears it, and the second finds nothing to
    do. Listeners are attached in the ref callback rather than an effect, since
    the ref runs at commit and an effect may not have flushed yet.
  */
  const handlersRef = useRef({ onTouchStart, onTouchMove, onTouchEnd, onTouchCancel });
  useEffect(() => {
    handlersRef.current = { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
  }, [onTouchStart, onTouchMove, onTouchEnd, onTouchCancel]);

  const detachRef = useRef<(() => void) | null>(null);

  const containerRef = useCallback((el: HTMLElement | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (elRef.current) releaseTouchHover(elRef.current);
    elRef.current = el;
    if (!el) return;

    // Thin trampolines so the listeners stay stable while the handlers behind
    // them are free to change.
    const start = (e: TouchEvent) =>
      handlersRef.current.onTouchStart(e as unknown as React.TouchEvent);
    const move = (e: TouchEvent) =>
      handlersRef.current.onTouchMove(e as unknown as React.TouchEvent);
    const end = () => handlersRef.current.onTouchEnd();
    const cancel = () => handlersRef.current.onTouchCancel();

    const opts = { passive: true } as const;
    el.addEventListener("touchstart", start, opts);
    el.addEventListener("touchmove", move, opts);
    el.addEventListener("touchend", end, opts);
    el.addEventListener("touchcancel", cancel, opts);

    detachRef.current = () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, []);

  useEffect(() => () => detachRef.current?.(), []);

  return {
    active,
    supportsHover,
    touchProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
    containerRef,
    deactivate,
  };
}

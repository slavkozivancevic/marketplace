"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * Native-feeling pull-to-refresh, mobile + touch only.
 *
 * Why a custom implementation instead of the browser's own gesture: `html` is
 * `overflow: hidden` (see globals.css) and every page scrolls inside its own
 * `flex-1 overflow-y-auto` container, so the document never overscrolls and
 * Chrome's built-in pull-to-refresh has nothing to hook into. This listens on
 * the real scroller under the finger instead.
 *
 * Refresh means "re-fetch this screen's data", not `location.reload()`:
 * `router.refresh()` re-runs the server components and
 * `refetchQueries({ type: "active" })` re-runs the mounted React Query
 * subscriptions. Scroll position, open panels and form state all survive,
 * which is what a pull gesture is expected to do - a hard reload would throw
 * away the very screen the user is looking at.
 *
 * Gesture rules, in the order they're checked on each touch:
 *   - single finger, no modal overlay open (a Dialog/Sheet has its own scroll
 *     and its own dismiss gesture; refreshing underneath it is never intended)
 *   - the nearest scrollable ancestor of the touch target is already at the top
 *   - the drag is dominantly vertical, so horizontal carousels keep working
 * Only once all three hold does it call `preventDefault()` and take the
 * gesture over - up to that point the touch behaves completely normally.
 */

/** Pull distance (after resistance) that arms the refresh. */
const TRIGGER_PX = 64;
/** Hard clamp so the indicator can't be dragged off-screen. */
const MAX_PULL_PX = 96;
/** <1 makes the indicator lag the finger - the usual rubber-band feel. */
const RESISTANCE = 0.5;
/** Vertical travel before we commit to owning the gesture. */
const ENGAGE_PX = 8;
/** Spinner floor, so a fast refresh reads as an action instead of a flicker. */
const MIN_SPIN_MS = 600;
/** Never leave the spinner up forever if a refresh never settles. */
const SAFETY_MS = 10_000;

const MOBILE_TOUCH_QUERY = "(max-width: 767px) and (pointer: coarse)";

/** Modal surfaces own their gestures - same selectors the page-blur rule uses. */
const OVERLAY_SELECTOR =
  "[data-slot='dialog-overlay'], [data-slot='alert-dialog-overlay'], [data-slot='sheet-overlay']";

/**
 * Surfaces that float over the page and are never "the page you're refreshing".
 * Popper content (Select / DropdownMenu / Popover) and the non-modal chat
 * Sheet render no overlay element, so OVERLAY_SELECTOR can't see them; toasts
 * own the same swipe axis. `data-no-pull-refresh` is the manual opt-out for
 * anything else that drives its own vertical drag (e.g. dnd-kit sorting).
 */
const EXCLUDED_SELECTOR = [
  "[data-no-pull-refresh]",
  "[data-sonner-toaster]",
  "[data-radix-popper-content-wrapper]",
  "[role='dialog']",
  "[role='menu']",
  "[role='listbox']",
].join(", ");

/**
 * The element that would actually scroll if the user dragged here. Returns
 * `null` when nothing in the chain scrolls (short page) - which counts as
 * "at the top", so pull-to-refresh still works on those screens.
 */
function findScroller(start: Element | null): Element | null {
  let node: Element | null = start;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return node;
    }
    node = node.parentElement;
  }
  return null;
}

type Phase = "idle" | "pulling" | "refreshing";

export function PullToRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState(0);

  // Gesture bookkeeping stays in refs: touchmove fires at frame rate and must
  // not depend on a re-render having landed first.
  const pullRef = useRef(0); // live distance, so touchend needn't wait on state
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const scrollerRef = useRef<Element | null>(null);
  const trackingRef = useRef(false); // touch is a candidate
  const engagedRef = useRef(false); // gesture taken over, preventDefault active
  const refreshingRef = useRef(false);
  const startedAtRef = useRef(0);

  // Mobile widths + a coarse pointer. A desktop mouse dragging the page down
  // is not a refresh gesture, so the listeners simply aren't bound there.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_TOUCH_QUERY);
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Ref and state always move together - the ref is what the handlers read.
  const applyPull = useCallback((next: number) => {
    pullRef.current = next;
    setPull(next);
  }, []);

  const settle = useCallback(() => {
    trackingRef.current = false;
    engagedRef.current = false;
    scrollerRef.current = null;
  }, []);

  const runRefresh = useCallback(() => {
    refreshingRef.current = true;
    startedAtRef.current = Date.now();
    setPhase("refreshing");
    applyPull(TRIGGER_PX);
    startTransition(() => router.refresh());
    void queryClient.refetchQueries({ type: "active" }).catch(() => {});
  }, [applyPull, queryClient, router]);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      settle();
      if (refreshingRef.current) return;
      if (e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (!target) return;
      if (document.querySelector(OVERLAY_SELECTOR)) return;
      if (target.closest?.(EXCLUDED_SELECTOR)) return;

      const scroller = findScroller(target);
      if (scroller && scroller.scrollTop > 0) return;

      scrollerRef.current = scroller;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      trackingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startYRef.current;
      const dx = e.touches[0].clientX - startXRef.current;

      if (!engagedRef.current) {
        // Upward or sideways drag: hand the gesture back for good.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          trackingRef.current = false;
          return;
        }
        if (dy < ENGAGE_PX) return;
        // Momentum from a previous flick can still be settling; re-check that
        // the scroller really is pinned at the top before taking over.
        const scroller = scrollerRef.current;
        if (scroller && scroller.scrollTop > 0) {
          trackingRef.current = false;
          return;
        }
        engagedRef.current = true;
        setPhase("pulling");
      }

      // Non-passive listener (see the binding below), so this actually stops
      // the scroller from rubber-banding while we drive the indicator.
      if (e.cancelable) e.preventDefault();
      applyPull(Math.min(MAX_PULL_PX, dy * RESISTANCE));
    };

    const onTouchEnd = () => {
      if (!engagedRef.current) {
        settle();
        return;
      }
      const armed = pullRef.current >= TRIGGER_PX;
      settle();
      if (armed) {
        runRefresh();
      } else {
        setPhase("idle");
        applyPull(0);
      }
    };

    // `passive: false` on touchmove only - it's the sole listener that calls
    // preventDefault(); the others stay passive so scrolling isn't penalised.
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, applyPull, runRefresh, settle]);

  // Retract once the RSC transition has settled, honouring the spinner floor.
  useEffect(() => {
    if (phase !== "refreshing" || isPending) return;
    const remaining = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAtRef.current));
    const t = window.setTimeout(() => {
      refreshingRef.current = false;
      setPhase("idle");
      applyPull(0);
    }, remaining);
    return () => window.clearTimeout(t);
  }, [phase, isPending, applyPull]);

  // Backstop for a refresh that never resolves (offline, aborted navigation).
  useEffect(() => {
    if (phase !== "refreshing") return;
    const t = window.setTimeout(() => {
      refreshingRef.current = false;
      setPhase("idle");
      applyPull(0);
    }, SAFETY_MS);
    return () => window.clearTimeout(t);
  }, [phase, applyPull]);

  if (!enabled || phase === "idle") return null;

  const armed = phase === "refreshing" || pull >= TRIGGER_PX;
  const progress = Math.min(1, pull / TRIGGER_PX);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-9998 flex justify-center"
      style={{
        transform: `translateY(${pull}px)`,
        // Follow the finger 1:1 while pulling; ease only on the way back.
        transition: phase === "pulling" ? "none" : "transform 200ms ease-out",
      }}
    >
      <div
        className={cn(
          "mt-2 flex size-9 items-center justify-center rounded-full border bg-card shadow-md",
          armed && "border-primary/40",
        )}
        style={{ opacity: phase === "refreshing" ? 1 : progress }}
      >
        <RefreshCwIcon
          className={cn(
            "size-4",
            armed ? "text-primary" : "text-muted-foreground",
            phase === "refreshing" && "animate-spin",
          )}
          style={
            phase === "refreshing"
              ? undefined
              : { transform: `rotate(${progress * 270}deg)` }
          }
        />
      </div>
    </div>
  );
}
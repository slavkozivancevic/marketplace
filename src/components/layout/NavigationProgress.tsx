"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUnsavedGuardStore } from "@/lib/forms/unsavedGuard";
import { onNavigationStart } from "@/lib/navigation/navigationProgressSignal";

/**
 * Global top progress bar - the universal "something is happening" affordance
 * for route navigation. App Router waits for the destination server render
 * before swapping the screen; on routes without a `loading.tsx` boundary that
 * looks like a frozen click. This bar gives immediate feedback on every
 * pathname-changing navigation, app-wide, with zero per-link wiring.
 *
 * Dependency-free by design (no nprogress/toploader lib): it hooks the same
 * signals those libraries do, but styles straight off our theme tokens so it
 * tracks every selected theme in light and dark.
 *
 * How it works:
 *   - START: a capture-phase document click listener spots a left-click on an
 *     internal `<a>` whose pathname differs from the current one. Capture phase
 *     runs before React's delegated handler calls `preventDefault()` for the
 *     client navigation, so the click is still inspectable. Skipped when the
 *     unsaved-changes guard is armed - that click won't navigate yet (a
 *     confirm dialog decides), so starting here would be premature. Skipped
 *     too when the pointer moved between press and release: that is a drag
 *     (a carousel swipe over its cards), not a navigating click.
 *   - START (deferred navigations): the unsaved-changes guard (and anything
 *     else that navigates programmatically after its own gate) calls
 *     `emitNavigationStart()` right before the real `router.push`, so the bar
 *     still appears - just from the moment navigation actually begins instead
 *     of the original click.
 *   - FINISH: `usePathname()` changing means the navigation resolved.
 *   - SAFETY: if a start never resolves (full reload, aborted nav), a timeout
 *     retracts the bar so it can never get stuck.
 *
 * Only pathname-changing navigations are tracked, which keeps start/finish
 * symmetric and ignores query-only updates (filters/sort via nuqs), so the bar
 * never trickles forever on a same-page state change.
 */
const TRICKLE_MS = 300;
const SAFETY_MS = 12_000;
const DONE_HOLD_MS = 320;
// Pointer travel between press and release beyond which the gesture is a drag
// (carousel swipe, text selection) rather than a click that navigates.
const DRAG_SLOP_PX = 10;

export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // Imperative controls live in refs so the once-bound listeners always call
  // the current logic without needing to rebind. They only touch refs and the
  // (stable) state setters, so a stale closure is harmless.
  const runningRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const trickleRef = useRef<number | null>(null);
  // Where the last pointer press landed, to tell a click from a drag.
  const pressRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (trickleRef.current !== null) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
  };

  const finish = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    clearTimers();
    setProgress(100);
    setState("done");
    timersRef.current.push(
      window.setTimeout(() => {
        setState("idle");
        setProgress(0);
      }, DONE_HOLD_MS),
    );
  };

  const start = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    clearTimers();
    setState("loading");
    setProgress(8);
    // Ease toward 90% and hold - completion snaps it to 100%.
    trickleRef.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(0.4, (90 - p) * 0.08) : p));
    }, TRICKLE_MS);
    timersRef.current.push(window.setTimeout(finish, SAFETY_MS));
  };

  // Bind the navigation-start detector once.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      pressRef.current = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // A pointer that travelled before release was a drag, not a click:
      // carousels (embla) let you drag a slide strip by its cards, and they
      // swallow the resulting click on their own root - too late for this
      // capture-phase listener, which would otherwise start a bar for a
      // navigation that never happens. Distance tells the two apart before
      // anyone gets to preventDefault(). Keyboard-activated links report no
      // preceding press and are unaffected.
      // `detail === 0` is a keyboard/programmatic click with no press behind
      // it, so the distance check would compare against a stale press.
      const press = e.detail > 0 ? pressRef.current : null;
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_SLOP_PX) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      // Card-wide links (product grid, etc.) wrap nested action buttons -
      // add-to-cart, wishlist, popover triggers - that call their own
      // preventDefault()/stopPropagation(). That runs in the bubble phase,
      // too late to stop this capture-phase listener, which would otherwise
      // start the bar for a click that never navigates. Real link
      // navigation never originates on a nested interactive element (you
      // can't validly nest a <button> inside an <a>), so use that to tell
      // the two apart structurally instead of relying on phase ordering.
      const interactive = target?.closest("button, [role='button'], input, select, textarea");
      if (interactive && anchor.contains(interactive)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // external
      if (url.pathname === window.location.pathname) return; // query/hash-only
      // The unsaved-changes guard mounts deeper in the tree, so its own
      // capture-phase listener registers - and therefore runs - after this
      // one; this component would otherwise always start the bar before the
      // guard gets a chance to preventDefault() and show its dialog. Defer to
      // it here; emitNavigationStart() (below) covers the "user confirmed
      // leaving" case.
      if (useUnsavedGuardStore.getState().hasUnsaved()) return;

      start();
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lets a deferred/programmatic navigation (see the unsaved-changes guard)
  // start the bar once it actually proceeds, instead of on the original click.
  useEffect(() => {
    onNavigationStart(start);
    return () => onNavigationStart(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pathname change means the navigation resolved. Skips the initial mount
  // because no navigation is running then (finish() no-ops when idle).
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (state === "idle") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-9999"
    >
      <div
        className="h-0.5 rounded-r-full bg-primary transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: state === "done" ? 0 : 1,
          boxShadow:
            "0 0 8px var(--color-primary), 0 0 4px var(--color-primary)",
        }}
      />
    </div>
  );
}

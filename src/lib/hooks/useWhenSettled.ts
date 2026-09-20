"use client";

import { useEffect, useRef } from "react";

/**
 * Defers work until the transition that will SHOW its result has settled.
 *
 * A server action returns long before the screen reflects it. Anything that
 * belongs to the RESULT rather than to the request - announcing success, closing
 * an editor to reveal the updated record behind it - has to wait for the frame
 * where that result is actually on screen, or it lands against stale content.
 *
 * `router.refresh()` called inside a transition keeps that transition pending
 * until the new RSC payload has been applied, so the falling edge of `isPending`
 * IS that frame. Queue from inside the transition and this runs it there; the
 * spinner on the clicked control therefore also runs for exactly as long as the
 * change takes to appear.
 *
 * Lists that render from React Query instead (`await invalidateQueries(...)`)
 * don't need this: awaiting the refetch already lands on the same moment.
 */
export function useWhenSettled(isPending: boolean) {
  const queued = useRef<(() => void) | null>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    const run = queued.current;
    queued.current = null;
    run?.();
  }, [isPending]);

  /** Call from inside the transition, after the action succeeds. */
  return (run: () => void) => {
    queued.current = run;
  };
}

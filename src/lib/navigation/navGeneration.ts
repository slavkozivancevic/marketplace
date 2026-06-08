"use client";

import { useSyncExternalStore } from "react";

/**
 * A counter that increments on every real client-side path change.
 *
 * Why: Next's client Router Cache can keep a route's React subtree alive when you
 * navigate away and restore it on return, so a form in it survives with unsaved
 * edits and no remount to reset it. Components read this counter (via
 * `useNavigationGeneration`) and key themselves on it, so returning to the page
 * after navigating elsewhere forces a fresh remount instead of restoring the
 * stale tree.
 *
 * The "did the path change" bookkeeping lives at MODULE level (`lastPath`), not in
 * a component ref, so it stays correct even if the tracker component remounts -
 * the bug in the first attempt was a per-component "skip first render" guard that
 * reset on every tracker remount and therefore never bumped.
 */
let generation = 0;
let lastPath: string | null = null;
const listeners = new Set<() => void>();

/** Called by the navigation tracker with the current pathname on every change. */
export function notifyPath(pathname: string): void {
  if (lastPath === null) {
    // First observation this session - establish a baseline, don't count it.
    lastPath = pathname;
    return;
  }
  if (pathname === lastPath) return;
  lastPath = pathname;
  generation += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return generation;
}

function getServerSnapshot(): number {
  return 0;
}

export function useNavigationGeneration(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

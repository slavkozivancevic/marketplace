"use client";

/**
 * Lets code that performs a *programmatic* in-app navigation kick off the top
 * progress bar explicitly - for navigations NavigationProgress's own anchor
 * click-detector can't see, chiefly the unsaved-changes guard: it defers the
 * real `router.push` until the user confirms leaving, so the bar must start
 * then, not on the original click. A standalone module (rather than an import
 * between NavigationProgress and the guard store) avoids a circular import.
 */
let listener: ((target?: string) => void) | null = null;

export function onNavigationStart(fn: ((target?: string) => void) | null) {
  listener = fn;
}

/** `target` (path + search + hash) lets the stuck-navigation diagnostics watch it. */
export function emitNavigationStart(target?: string) {
  listener?.(target);
}

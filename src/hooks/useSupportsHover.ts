import { useSyncExternalStore } from "react";

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(HOVER_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(HOVER_QUERY).matches;
}

// Pre-touch-support behavior, and the value the server renders with.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * True when the device's primary input can hover (mouse/trackpad), false for
 * touch/stylus-primary devices, and kept in sync for devices that can switch
 * primary input (a 2-in-1 laptop).
 *
 * `useSyncExternalStore` rather than state + effect, specifically for the
 * hydration pass: React renders the *server* snapshot on the client's first
 * render, so the markup matches what the server sent, then swaps to the real
 * media-query result immediately after. Reading matchMedia during the first
 * render instead (a lazy `useState` initializer) produced a hydration mismatch
 * on touch-primary devices - React reports those and does not patch them up.
 */
export function useSupportsHover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

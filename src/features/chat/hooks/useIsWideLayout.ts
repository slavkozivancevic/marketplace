import { useSyncExternalStore } from "react";

/** Tailwind's `lg` - where the page draws its inbox inline instead of in a sheet. */
const WIDE_QUERY = "(min-width: 64rem)";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(WIDE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * True at `lg` and wider. Layout itself stays in CSS (`lg:` classes); this is
 * only for behaviour CSS cannot express - whether the inbox sheet may open,
 * and whether the composer counts as a bottom bar the floating button must
 * clear. `useSyncExternalStore` for the same hydration reason as
 * `useSupportsHover`.
 */
export function useIsWideLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

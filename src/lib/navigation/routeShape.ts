/**
 * A hand-off from the page a user clicks on to the route skeleton that shows
 * next. A loading.tsx gets no data, so for an edit form whose rows depend on
 * the record (which fields a price rule has depends on its kind, repeat and
 * change type; a description box is as tall as its text) it can only guess -
 * and a wrong guess is a layout shift the moment the form lands. The list that
 * holds the record knows its shape: it calls `setRouteShape` right before
 * navigating, and the skeleton reads it back with `readRouteShape`, keyed by
 * the record id.
 *
 * Written only from click handlers, so it only ever holds something in the
 * browser: a server render (and the hydration of a hard load) always reads
 * nothing and draws the default shape. A hand-off lives for the navigation it
 * was made for - a few seconds - and then expires, so a later visit to the
 * same URL, after the record may have been edited, cannot pick up a stale one.
 */
const TTL_MS = 30_000;

let pending: { key: string; shape: unknown; at: number } | null = null;

export function setRouteShape(key: string, shape: unknown): void {
  pending = { key, shape, at: Date.now() };
}

export function readRouteShape<T>(key: string): T | null {
  if (!pending || pending.key !== key || Date.now() - pending.at > TTL_MS) return null;
  return pending.shape as T;
}

export function clearRouteShape(key: string): void {
  if (pending?.key === key) pending = null;
}

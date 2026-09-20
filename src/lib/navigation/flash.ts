"use client";

/**
 * A one-shot message that outlives a client-side navigation.
 *
 * Why: a create or an edit confirms itself on the LIST it returns to, not on the
 * form it is leaving. The form cannot raise that toast itself - it unmounts the
 * moment the new route commits, and raising it before the push puts a "done"
 * message next to a button that is still spinning through the navigation. So the
 * form leaves the message here and the `<FlashHost>` next to the `<Toaster>`
 * flushes it once the navigation has actually landed. Same shape as Rails'
 * `flash[:notice]` or Django's `messages.success()`.
 *
 * Module level, not React state: the whole point is to survive the unmount.
 *
 * A flash is addressed to ONE page - the pathname its queuer is navigating to -
 * and waits there. That is what keeps "Tag updated" from surfacing on whatever
 * page the user went to instead when the navigation never happened. It still
 * expires, so an abandoned navigation cannot confirm itself minutes later if the
 * user eventually wanders onto the target page by hand.
 */
export type FlashKind = "success" | "error";
export type Flash = { kind: FlashKind; message: string };

/**
 * Long enough for any real navigation (a cold Neon instance waking up mid-push
 * is the worst case), short enough that the message is still about what the user
 * just did. Generous because the target pathname already decides WHERE it can
 * appear - this only decides how long it waits.
 */
const MAX_AGE_MS = 60_000;

type QueuedFlash = Flash & { at: number; path: string | null };

let queued: QueuedFlash | null = null;

/**
 * Queue a message for the navigation that is about to start.
 *
 * `path` is the locale-prefixed pathname being pushed (`/sr/admin/tags`); pass
 * the same string handed to `router.push`. Omitting it means "the next
 * navigation, wherever it goes" - only for callers that cannot know their
 * target.
 */
export function setFlash(
  message: string,
  options: { path?: string; kind?: FlashKind } = {},
): void {
  const { path, kind = "success" } = options;
  queued = {
    kind,
    message,
    at: Date.now(),
    // usePathname reports neither, so they would never match.
    path: path ? path.split("?")[0].split("#")[0] : null,
  };
}

/**
 * Read and clear the message waiting for `pathname`. Returns null when there is
 * none, when the queued one is addressed to a different page (it stays queued
 * for the navigation it belongs to), or when it has gone stale.
 */
export function takeFlashFor(pathname: string): Flash | null {
  const flash = queued;
  if (!flash) return null;

  const expired = Date.now() - flash.at > MAX_AGE_MS;

  if (flash.path !== null && flash.path !== pathname) {
    // Someone else's stop - keep waiting, unless it has waited too long.
    if (expired) queued = null;
    return null;
  }

  queued = null;
  return expired ? null : { kind: flash.kind, message: flash.message };
}

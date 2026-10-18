/**
 * The one retry policy for every remote image the app draws.
 *
 * A remote image can fail for reasons that have nothing to do with the image:
 * a cold optimizer pulling two dozen originals at once on the first visit, a
 * freshly uploaded object that S3/the CDN has not served yet, a network blip.
 * next/image never retries a failed src on its own, so without this a single
 * bad moment becomes a dead frame until a full reload.
 *
 * The budget used to be two retries 1.5s apart (about 4.5s in all), copied
 * separately into `RetryImage` and `HoverImageCycler`. A cold optimizer can
 * outlast that - the hero mosaic showed its "unavailable" placeholder for a
 * URL that answered 200 a moment later. Now it is one list, and long enough.
 */
export const IMAGE_RETRY_DELAYS_MS = [1500, 3000, 6000, 12000] as const;

/**
 * How many extra rounds a given-up image may get from `onImageRevival`.
 *
 * Capped because revival cannot tell a transient failure from a URL that is
 * genuinely gone (a deleted S3 object answers 404 every time): uncapped, every
 * tab switch would send one more full round of requests per dead image, for
 * as long as the page stays open.
 */
export const IMAGE_MAX_REVIVALS = 2;

/** Delay before retry number `attempt` (0-based), or null once the budget is spent. */
export function imageRetryDelay(attempt: number): number | null {
  return IMAGE_RETRY_DELAYS_MS[attempt] ?? null;
}

type RevivalTargets = {
  win: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  doc: Pick<EventTarget, "addEventListener" | "removeEventListener"> & {
    visibilityState: DocumentVisibilityState;
  };
};

/**
 * Calls `revive` when the conditions that most likely killed an image are
 * gone: the connection came back, or the tab became visible again (a
 * backgrounded tab is where throttled, half-finished fetches pile up). An
 * image that has given up subscribes to this and gets one more full round
 * instead of staying on its placeholder until a reload.
 *
 * Returns the unsubscribe. The targets are injectable for tests only.
 */
export function onImageRevival(
  revive: () => void,
  targets?: RevivalTargets,
): () => void {
  if (!targets && typeof window === "undefined") return () => {};
  const { win, doc } = targets ?? { win: window, doc: document };

  const onVisibility = () => {
    if (doc.visibilityState === "visible") revive();
  };
  win.addEventListener("online", revive);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.removeEventListener("online", revive);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

"use client";

/**
 * Settles an image's loading placeholder, however the image finishes.
 *
 * Every carousel, lightbox and thumbnail in the app that draws its OWN shimmer
 * (rather than letting `<RetryImage>` draw one) has to know when to take it
 * away, and they all used the same one-line ref callback:
 *
 *     ref={(img) => { if (img?.complete && img.naturalWidth > 0) mark(); }}
 *
 * That check answers "is this already painted?" at the instant the ref runs,
 * and it misses an image that finishes just AFTER that but before React has
 * attached `onLoad`. next/image dedupes `onLoad` per DOM node through its
 * `data-loaded-src` marker, so once it has decided the node is done our
 * handler never fires at all - and the shimmer sits over a fully loaded
 * photograph until the page is reloaded. Reproduced on the product detail page
 * about one load in six, with `img.complete === true` and
 * `naturalWidth === 640` underneath it.
 *
 * A native listener cannot be deduped away by next/image, and `once` makes it
 * self-cleaning, so this closes the gap without touching next/image's path.
 * `mark` must be idempotent - it can be called from either branch, and a ref
 * callback may run more than once for the same node.
 */
export function settleOnLoad(img: HTMLImageElement | null, mark: () => void) {
  if (!img) return;
  if (img.complete && img.naturalWidth > 0) {
    mark();
    return;
  }
  img.addEventListener("load", mark, { once: true });
  img.addEventListener("error", mark, { once: true });
}

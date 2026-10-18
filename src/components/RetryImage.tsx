"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Ref, SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageUnavailable } from "@/components/ImageUnavailable";
import {
  IMAGE_MAX_REVIVALS,
  imageRetryDelay,
  onImageRevival,
} from "@/lib/imageRetry";

// A freshly uploaded image is cold end-to-end (CDN miss + first optimizer
// resize), so its very first fetch can fail; next/image never retries a
// failed src, which would leave the frame broken (alt text shown) until a
// full page reload. Remounting the <Image> (key bump) forces a fresh attempt.
// The budget and the revival triggers are shared - see `@/lib/imageRetry`.

type RetryImageProps = Omit<ImageProps, "onError"> & {
  ref?: Ref<HTMLImageElement>;
  /**
   * Fires on every failed attempt. `willRetry` says whether a retry is
   * already queued - callers with their own loading placeholder should only
   * treat the image as settled once `willRetry` is false.
   */
  onError?: (event: SyntheticEvent<HTMLImageElement, Event>, willRetry: boolean) => void;
  /**
   * Shows the shared `skeleton-shimmer` placeholder while the image is
   * loading or retrying, so a cold fetch never flashes broken-image alt text
   * in its place. On by default - turn off only when the caller already
   * renders its own loading placeholder driven by `onLoad`/`onError`.
   * Requires a `relative`-positioned parent (true for the standard `fill`
   * pattern used across the app).
   */
  showShimmer?: boolean;
  /**
   * Shows the shared `ImageUnavailable` placeholder once every retry has
   * been exhausted and the image still hasn't loaded, instead of leaving the
   * browser's native broken-image icon + alt text in its place. On by
   * default - turn off only when the caller renders its own terminal-failure
   * UI.
   */
  showFallback?: boolean;
};

export function RetryImage({
  onLoad,
  onError,
  alt,
  src,
  ref,
  showShimmer = true,
  showFallback = true,
  ...props
}: RetryImageProps) {
  // `attempt` is the budget spent in this round; `generation` drives the key
  // and only ever grows, so a revival after a spent round still remounts.
  const [attempt, setAttempt] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [revivals, setRevivals] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Tracks the src this attempt/loaded pair belongs to, compared during
  // render rather than in a useEffect. Next.js's Router Cache keeps a page
  // that's navigated away from alive but hidden instead of unmounting it, and
  // reviving it on back-navigation re-runs mount effects while DOM + state
  // both persist - a `useEffect([src])` reset would fire again on that
  // revive even though src never changed, clearing `loaded` on an <img> that
  // already fired its one-and-only load event and will never fire another
  // (next/image's own loader dedupes onLoad per DOM node via a
  // `data-loaded-src` marker), leaving the shimmer stuck forever. Comparing
  // during render only resets when src has actually changed.
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setAttempt(0);
    setGeneration((g) => g + 1);
    setRevivals(0);
    setLoaded(false);
    setFailed(false);
  }

  // A queued retry belongs to the src it was queued for and is dropped if the
  // src has moved on by the time it fires. Deliberately NOT cleared in an
  // effect cleanup: the Router Cache hides a page by running its cleanups and
  // revives it with state intact, so a cleared timer would strand the image
  // mid-retry - not failed, never loaded, shimmer forever.
  const currentSrcRef = useRef(src);
  useEffect(() => {
    currentSrcRef.current = src;
  }, [src]);

  /*
    One failure per attempt. next/image re-assigns `img.src = img.src` every
    time its ref callback changes (it does so to catch an error that fired
    before hydration), and on an image that has already failed that is a new
    request and a second `error` on the SAME node. Counting each one queued two
    retries per attempt: the budget ran out in half the time and the timers
    overlapped - measured as six requests in 9s instead of five spread over
    22s. The generation identifies the attempt, so later errors from the same
    one are ignored.
  */
  const handledGenerationRef = useRef(-1);

  // Given up? Try one more full round once the connection is back or the tab
  // is visible again, instead of holding the placeholder until a reload.
  useEffect(() => {
    if (!failed || revivals >= IMAGE_MAX_REVIVALS) return;
    return onImageRevival(() => {
      setFailed(false);
      setLoaded(false);
      setAttempt(0);
      setGeneration((g) => g + 1);
      setRevivals((r) => r + 1);
    });
  }, [failed, revivals]);

  // Forwards the caller's own ref (if any) and, when the shimmer is on, also
  // catches an image that finishes before React attaches `onLoad` - already
  // `complete` when the ref runs, or landing just after it. next/image dedupes
  // `onLoad` per DOM node, so either case would otherwise leave the shimmer
  // spinning over a loaded photograph. A native listener cannot be deduped
  // away (same gap `settleOnLoad` closes; load only here, because an error
  // mid-retry must not settle the shimmer).
  const setImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      if (!showShimmer || !node) return;
      if (node.complete && node.naturalWidth > 0) setLoaded(true);
      else node.addEventListener("load", () => setLoaded(true), { once: true });
    },
    [ref, showShimmer],
  );

  return (
    <>
      {showShimmer && !loaded && (
        <div className="absolute inset-0 z-10 skeleton-shimmer pointer-events-none" />
      )}
      {showFallback && failed && <ImageUnavailable />}
      <Image
        {...props}
        ref={setImageRef}
        alt={alt}
        src={src}
        key={`${src}#${generation}`}
        onLoad={(e) => {
          if (showShimmer) setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          if (handledGenerationRef.current === generation) return;
          handledGenerationRef.current = generation;
          const delay = imageRetryDelay(attempt);
          const willRetry = delay !== null;
          if (showShimmer && !willRetry) setLoaded(true);
          if (!willRetry) setFailed(true);
          onError?.(e, willRetry);
          if (!willRetry) return;
          const queuedFor = src;
          setTimeout(() => {
            if (currentSrcRef.current !== queuedFor) return;
            setAttempt((a) => a + 1);
            setGeneration((g) => g + 1);
          }, delay);
        }}
      />
    </>
  );
}

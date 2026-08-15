"use client";

import { useCallback, useState } from "react";
import type { Ref, SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageUnavailable } from "@/components/ImageUnavailable";

// A freshly uploaded image is cold end-to-end (CDN miss + first optimizer
// resize), so its very first fetch can fail; next/image never retries a
// failed src, which would leave the frame broken (alt text shown) until a
// full page reload. Remounting the <Image> (key bump) forces a fresh attempt.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

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
  const [attempt, setAttempt] = useState(0);
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
    setLoaded(false);
    setFailed(false);
  }

  // Forwards the caller's own ref (if any) and, when the shimmer is on, also
  // catches a cached image reporting `complete` before React attaches
  // `onLoad` - which would otherwise leave the shimmer spinning forever.
  const setImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      if (showShimmer && node?.complete && node.naturalWidth > 0) setLoaded(true);
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
        key={`${src}#${attempt}`}
        onLoad={(e) => {
          if (showShimmer) setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          const willRetry = attempt < MAX_RETRIES;
          if (showShimmer && !willRetry) setLoaded(true);
          if (!willRetry) setFailed(true);
          onError?.(e, willRetry);
          if (!willRetry) return;
          setTimeout(
            () => setAttempt((a) => a + 1),
            RETRY_DELAY_MS * (attempt + 1),
          );
        }}
      />
    </>
  );
}

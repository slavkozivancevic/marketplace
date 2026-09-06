"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { claimTouchCycle, releaseTouchCycle } from "./touchCycleCoordinator";
import { useSupportsHover } from "@/hooks/useSupportsHover";
import { ImageUnavailable } from "@/components/ImageUnavailable";

interface HoverImageCyclerProps {
  images: string[];
  alt: string;
  className?: string;
  intervalMs?: number;
  sizes?: string;
  // Indexes in `images` whose URL is a video poster (not a still image).
  // When the cycle lands on one, a play icon overlays the frame so the user
  // can tell at a glance that this slot is a video on the detail page.
  videoIndexes?: Set<number>;
}

// A freshly uploaded image is cold end-to-end (CDN miss + first optimizer
// resize), so its very first fetch can fail; next/image never retries a
// failed src, which would leave the frame broken until a full page reload.
// Remounting the <Image> (key bump) forces a fresh attempt.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// How far a finger must travel before a touch counts as the start of a swipe
// rather than a tap - the touch equivalent of the cursor landing on a card.
const TOUCH_ACTIVATE_PX = 8;

export function HoverImageCycler({
  images,
  alt,
  className,
  intervalMs = 900,
  sizes = "(max-width: 768px) 100vw, 33vw",
  videoIndexes,
}: HoverImageCyclerProps) {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // First image drives the shimmer; it clears on load OR error so it can
  // never spin forever.
  const [firstSettled, setFirstSettled] = useState(false);
  // Per-URL load tracking: the cycle only ever advances onto a frame that has
  // actually loaded, so a slow/cold frame keeps the current image visible
  // instead of flashing broken-image alt text.
  const [loadedUrls, setLoadedUrls] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // URLs that have exhausted every retry - the currently-displayed frame
  // shows the shared "unavailable" placeholder instead of the browser's
  // native broken-image icon + alt text while its URL is in this set.
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  // Devices whose primary input has no hover (touch/stylus) never fire
  // mouseenter, so the cycle - and the vignette that's meant to lift while
  // "hovered" - is driven by the finger instead (see the touch handlers).
  const supportsHover = useSupportsHover();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Mirrors `index` for the interval callback, which needs the frame showing
  // right now without being re-created on every advance.
  const indexRef = useRef(0);
  // Set once the finger lifts mid-cycle: keep going, but stop on the wrap
  // back to the first image.
  const finishingRef = useRef(false);
  // Where the current touch started, until it either becomes a swipe or ends.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Mirror for the interval closure (state there would be stale).
  const loadedUrlsRef = useRef(loadedUrls);
  useEffect(() => {
    loadedUrlsRef.current = loadedUrls;
  }, [loadedUrls]);

  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const markFailed = useCallback((url: string) => {
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  // A cached image can be `complete` before React attaches `onLoad`, so the
  // event is missed; this ref callback catches that on mount. The URL rides
  // along as a data attribute so one stable callback serves every frame.
  const completeCheckRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete || img.naturalWidth <= 0) return;
      const url = img.getAttribute("data-cycler-url");
      if (!url) return;
      markLoaded(url);
      if (url === img.getAttribute("data-cycler-first")) setFirstSettled(true);
    },
    [markLoaded],
  );

  useEffect(() => {
    const retryTimers = retryTimersRef.current;
    const container = containerRef.current;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      for (const t of retryTimers) clearTimeout(t);
      // Never leave the shared slot pointing at an unmounted card.
      if (container) releaseTouchCycle(container);
    };
  }, []);

  const stopCycle = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    finishingRef.current = false;
    setIsHovered(false);
    indexRef.current = 0;
    setIndex(0);
    if (containerRef.current) releaseTouchCycle(containerRef.current);
  }, []);

  const handleEnter = useCallback(() => {
    setIsHovered(true);
    finishingRef.current = false;
    if (images.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      // Advance to the nearest loaded frame; hold the current one if no
      // other frame is ready yet (it joins the cycle once it loads).
      const current = indexRef.current;
      let next = current;
      for (let step = 1; step <= images.length; step++) {
        const candidate = (current + step) % images.length;
        if (loadedUrlsRef.current.has(images[candidate])) {
          next = candidate;
          break;
        }
      }
      if (next === current) return;
      indexRef.current = next;
      setIndex(next);
      // Wrapped back to the first frame after the finger was lifted: the lap
      // the touch started has shown every image, so the card settles here.
      if (finishingRef.current && next === 0) stopCycle();
    }, intervalMs);
  }, [images, intervalMs, stopCycle]);

  // Touch/stylus devices never fire mouseenter, so the finger stands in for
  // the cursor: a touch that turns into a swipe (any direction - typically
  // the page scroll the user was starting anyway) activates that one card,
  // the same way moving the mouse onto a card does. A plain tap is left
  // alone so it still opens the product.
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (supportsHover || images.length <= 1) return;
      const touch = e.touches[0];
      touchStartRef.current = touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
    },
    [supportsHover, images.length],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      const touch = e.touches[0];
      if (!start || !touch) return;
      if (
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) <
        TOUCH_ACTIVATE_PX
      ) {
        return;
      }
      // Activate once per touch, not on every subsequent move.
      touchStartRef.current = null;
      // The cycle outlives the touch (see below), so claiming the shared slot
      // stops whichever card was still finishing its lap - one card animates
      // at a time, exactly like a cursor moving between cards.
      if (containerRef.current) claimTouchCycle(containerRef.current, stopCycle);
      handleEnter();
    },
    [handleEnter, stopCycle],
  );

  // Lifting the finger doesn't cut the cycle short - it lets it run to the
  // end of the lap (back to the first image) and stop there, so a quick swipe
  // is enough to see every image of the card you touched.
  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    if (timerRef.current) finishingRef.current = true;
  }, []);

  if (images.length === 0) return null;

  const handleLoad = (url: string, isFirst: boolean) => {
    markLoaded(url);
    if (isFirst) setFirstSettled(true);
  };

  const handleError = (url: string, isFirst: boolean) => {
    const attempts = retryCounts[url] ?? 0;
    if (attempts >= MAX_RETRIES) {
      // Every retry exhausted - settle for real now (not mid-retry, so the
      // shimmer doesn't hand off to a frame that's still about to recover)
      // and mark the frame so its display slot swaps to the placeholder.
      markFailed(url);
      if (isFirst) setFirstSettled(true);
      return;
    }
    const t = setTimeout(() => {
      setRetryCounts((prev) => ({ ...prev, [url]: attempts + 1 }));
    }, RETRY_DELAY_MS * (attempts + 1));
    retryTimersRef.current.push(t);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        images.length > 1 && "cursor-grab",
        className,
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={stopCycle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {!firstSettled && (
        <div className="absolute inset-0 z-10 skeleton-shimmer" />
      )}
      {failedUrls.has(images[index]) && !loadedUrls.has(images[index]) && (
        <ImageUnavailable />
      )}
      {images.map((url, i) => (
        <Image
          key={`${url}#${retryCounts[url] ?? 0}`}
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          className={cn(
            "object-cover transition-opacity duration-500",
            i === index ? "opacity-100" : "opacity-0",
          )}
          priority={i === 0}
          ref={completeCheckRef}
          data-cycler-url={url}
          data-cycler-first={images[0]}
          onLoad={() => handleLoad(url, i === 0)}
          onError={() => handleError(url, i === 0)}
        />
      ))}
      {videoIndexes?.has(index) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PlayCircle className="text-white drop-shadow-lg" size={48} strokeWidth={1.5} />
        </div>
      )}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isHovered ? "opacity-0" : "opacity-100",
        )}
        style={{
          background: [
            "to right",
            "to left",
            "to bottom",
            "to top",
          ].map(dir =>
            `linear-gradient(${dir},` +
            `color-mix(in oklch, var(--background) 55%, transparent) 0%,` +
            `color-mix(in oklch, var(--background) 30%, transparent) 7%,` +
            `color-mix(in oklch, var(--background) 10%, transparent) 14%,` +
            `color-mix(in oklch, var(--background) 2%, transparent) 20%,` +
            `transparent 25%)`
          ).join(", "),
          transition: isHovered
            ? "opacity 700ms ease"
            : "opacity 300ms ease",
        }}
      />
      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-white" : "bg-white/50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

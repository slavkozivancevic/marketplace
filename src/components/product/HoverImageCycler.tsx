"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTouchHover } from "@/hooks/useTouchHover";
import { isTouchInput } from "@/lib/touchInput";
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

// How long a single-image card stays lit after the finger lifts. A card with
// several images ends itself instead, on the lap back to the first frame.
const SINGLE_IMAGE_HOLD_MS = 2600;

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Mirrors `index` for the interval callback, which needs the frame showing
  // right now without being re-created on every advance.
  const indexRef = useRef(0);
  // Set once the finger lifts mid-cycle: keep going, but stop on the wrap
  // back to the first image.
  const finishingRef = useRef(false);

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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      for (const t of retryTimers) clearTimeout(t);
    };
  }, []);

  // A single-image card has no lap to run out, so the hook's hold timer ends
  // it; a multi-image one keeps going until the cycle wraps and calls
  // `deactivate` itself. Either way the vignette lifts, which is the part that
  // used to be missing: the old code bailed out of touch entirely on
  // `images.length <= 1`, so a product with one photograph could not be
  // "hovered" on a phone at all.
  const hasCycle = images.length > 1;

  const stopCycle = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    finishingRef.current = false;
    setIsHovered(false);
    indexRef.current = 0;
    setIndex(0);
  }, []);

  // The hook needs `handleEnter`, which needs `stopCycle`, which the hook also
  // wires up - a ref breaks that ordering knot without reordering the file.
  const handleEnterRef = useRef<() => void>(() => {});

  const {
    containerRef: touchContainerRef,
    touchProps,
    deactivate: endTouchHover,
    supportsHover,
  } = useTouchHover({
    holdMs: hasCycle ? null : SINGLE_IMAGE_HOLD_MS,
    onActivate: () => handleEnterRef.current(),
    onDeactivate: stopCycle,
    // Lifting the finger doesn't cut the cycle short - it lets it run to the
    // end of the lap (back to the first image) and stop there, so a quick
    // swipe is enough to see every image of the card you touched. Driven from
    // the hook so it fires whichever route delivered the touch.
    onRelease: () => {
      if (timerRef.current) finishingRef.current = true;
    },
  });

  // Ends the lap AND gives up the shared slot. `stopCycle` alone would leave
  // the hook still holding the card active, so the next card's swipe would be
  // the only thing that ever released it.
  const endCycle = useCallback(() => {
    stopCycle();
    endTouchHover();
  }, [stopCycle, endTouchHover]);

  const endCycleRef = useRef(endCycle);
  useEffect(() => {
    endCycleRef.current = endCycle;
  }, [endCycle]);

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
      if (finishingRef.current && next === 0) endCycleRef.current();
    }, intervalMs);
  }, [images, intervalMs]);

  useEffect(() => {
    handleEnterRef.current = handleEnter;
  }, [handleEnter]);

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
      ref={(el) => {
        containerRef.current = el;
        touchContainerRef(el);
      }}
      className={cn(
        "relative overflow-hidden",
        images.length > 1 && "cursor-grab",
        className,
      )}
      // A touch screen fires a synthetic `mouseenter` right after a tap, which
      // would start the cycle on the tap rather than on the swipe - and leave
      // it running, because no `mouseleave` follows until something else is
      // touched. `isTouchInput()` is checked at call time rather than through
      // the media query, because the query reports what the device CAN do and
      // is wrong about it under emulation and on 2-in-1 laptops.
      onMouseEnter={
        supportsHover
          ? () => {
              if (isTouchInput()) return;
              handleEnter();
            }
          : undefined
      }
      onMouseLeave={supportsHover ? stopCycle : undefined}
      onTouchStart={touchProps.onTouchStart}
      onTouchMove={touchProps.onTouchMove}
      onTouchEnd={touchProps.onTouchEnd}
      onTouchCancel={touchProps.onTouchCancel}
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
      {/* `.theme-vignette` (globals.css), the same wash the department cards,
          the hero collage and the brand strip carry. It used to be a hand-
          rolled copy of the gradient right here, with a softer five-stop ramp
          than the three-stop one the cards used - the identical effect, subtly
          different on two pages. The shared rule now carries the softer ramp
          and this renders it like everywhere else.

          It sits after the images and before nothing that creates a stacking
          context, so the `z-10` shimmer above stays above it: the wash appears
          with the photograph, never over its placeholder. */}
      <div
        aria-hidden
        className={cn(
          "theme-vignette",
          isHovered && "opacity-0 duration-700",
        )}
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

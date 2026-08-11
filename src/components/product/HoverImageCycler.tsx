"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerTouchFocusCycle } from "./touchFocusCycle";

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
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  // Devices whose primary input has no hover (touch/stylus) never fire
  // mouseenter, so the cycle - and the vignette that's meant to lift while
  // "hovered" - would otherwise be stuck at rest forever. Read once
  // up-front (SSR default true, same as the pre-touch-support behavior;
  // never rendered into markup, so a client/server mismatch here is moot).
  const [supportsHover, setSupportsHover] = useState(() =>
    typeof window === "undefined" || !window.matchMedia
      ? true
      : window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  const handleEnter = useCallback(() => {
    setIsHovered(true);
    if (images.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => {
        // Advance to the nearest loaded frame; hold the current one if no
        // other frame is ready yet (it joins the cycle once it loads).
        for (let step = 1; step <= images.length; step++) {
          const next = (i + step) % images.length;
          if (loadedUrlsRef.current.has(images[next])) return next;
        }
        return i;
      });
    }, intervalMs);
  }, [images, intervalMs]);

  const handleLeave = useCallback(() => {
    setIsHovered(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIndex(0);
  }, []);

  // Keep the primary-pointer detection in sync (e.g. a 2-in-1 laptop
  // switching between touch and trackpad).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = (e: MediaQueryListEvent) => setSupportsHover(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Touch/stylus devices have no hover to drive the cycle or lift the
  // vignette, so on those a shared scroll-position coordinator stands in for
  // "hovered" instead - only the single card nearest the vertical center of
  // the viewport cycles (and clears its shadow) at any given time, instead
  // of every visible card animating at once.
  useEffect(() => {
    if (supportsHover) return;
    const el = containerRef.current;
    if (!el) return;
    return registerTouchFocusCycle(el, {
      onFocus: handleEnter,
      onBlur: handleLeave,
    });
  }, [supportsHover, handleEnter, handleLeave]);

  if (images.length === 0) return null;

  const handleLoad = (url: string, isFirst: boolean) => {
    markLoaded(url);
    if (isFirst) setFirstSettled(true);
  };

  const handleError = (url: string, isFirst: boolean) => {
    if (isFirst) setFirstSettled(true);
    const attempts = retryCounts[url] ?? 0;
    if (attempts >= MAX_RETRIES) return;
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
      onMouseLeave={handleLeave}
    >
      {!firstSettled && (
        <div className="absolute inset-0 z-10 skeleton-shimmer" />
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

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, PlayCircle } from "lucide-react";
import { RetryImage } from "@/components/RetryImage";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { MediaLightbox, type VideoHandoff } from "@/components/product/MediaLightbox";
import { ZoomHint, useZoomHint } from "@/components/product/ZoomHint";
import { cn } from "@/lib/utils";
import { IMAGE_ZOOM_FACTOR, IMAGE_ZOOM_LENS_SIZE } from "@/constants/constants";
import type { MediaType } from "@/generated/prisma/client";

export interface ProductMediaItem {
  id: string;
  url: string;
  mediaType: MediaType;
  thumbUrl?: string | null;
}

interface ProductImageCarouselProps {
  // Renamed from `images` - accepts mixed image+video media. The legacy file
  // name is kept to avoid churn across callers; the component itself is now
  // media-agnostic and routes IMAGE/VIDEO items to the right renderer.
  media: ProductMediaItem[];
  title: string;
  jumpToMediaId?: string | null;
  jumpTicket?: number;
}

function getThumbSrc(item: ProductMediaItem): string {
  // Always prefer the thumb (image thumbnail OR video poster) for thumbnail
  // strips. Fall back to `url` so legacy rows without thumbUrl still render.
  return item.thumbUrl ?? item.url;
}

// react-hooks/purity flags a direct `Date.now()` call anywhere lexically
// inside the component, even in an event handler that only ever runs from
// onTouchEnd - wrapping it in a plain (non-component) function sidesteps
// that, same as formatRelativeTime does in ReviewList.tsx.
function currentTimeMs(): number {
  return Date.now();
}

export function ProductImageCarousel({
  media,
  title,
  jumpToMediaId,
  jumpTicket,
}: ProductImageCarouselProps) {
  const t = useTranslations("products");
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoHandoff, setVideoHandoff] = useState<VideoHandoff | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  // Inline <video> elements, so the expand button can hand off the exact
  // playback position/state to the lightbox instead of it restarting muted.
  const videoElRefs = useRef(new Map<number, HTMLVideoElement>());

  // Clears a slide's shimmer once its image is painted. Guarded so re-marking an
  // already-loaded index returns the same Set reference (no needless re-render,
  // and no render loop when driven from a ref callback). Used by both `onLoad`
  // and a ref-callback `complete` check - the latter catches cached images that
  // finish before React attaches `onLoad`, which otherwise leaves the shimmer
  // spinning forever.
  const markImageLoaded = useCallback((index: number) => {
    setLoadedImages((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }, []);

  // Same shimmer mechanics for the thumbnail strip - without it, cold thumbs
  // (fresh product, empty CDN/optimizer cache) render as blank squares with
  // only the selected border visible until the image arrives.
  const [loadedThumbs, setLoadedThumbs] = useState<Set<number>>(new Set());
  const markThumbLoaded = useCallback((index: number) => {
    setLoadedThumbs((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }, []);

  // Tracks the lens's SHARP layer per slide, so it can fade in over the
  // already-cached soft layer instead of the lens sitting empty while a
  // fresh, larger image downloads. Same ref-callback `complete` guard as the
  // slides: a warm image can finish before React attaches `onLoad`.
  const [zoomHiResLoaded, setZoomHiResLoaded] = useState<Set<number>>(new Set());
  const markZoomHiResLoaded = useCallback((index: number) => {
    setZoomHiResLoaded((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }, []);
  const [zoomState, setZoomState] = useState<{
    index: number;
    x: number;
    y: number;
    containerW: number;
    containerH: number;
  } | null>(null);

  const handleZoomMove = (
    e: React.MouseEvent<HTMLDivElement>,
    index: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomState({
      index,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      containerW: rect.width,
      containerH: rect.height,
    });
  };

  const handleZoomLeave = () => setZoomState(null);

  // Touch has no hover, so the lens is entered with a double-tap (the
  // standard mobile convention - Instagram/Photos etc.) instead: the first
  // tap of a pair still needs a brief window to see whether a second one is
  // coming, so it can't open the lightbox immediately - see TAP_MAX_DELAY.
  // While `zoomedIndex` holds a slide, one-finger drag pans the lens there
  // instead of swiping; `watchDrag` below reads it via a ref (not state, so
  // the check stays in sync without waiting on a re-render) to keep embla
  // from also treating that same drag as a slide change.
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  // Touch-only badge that advertises that double-tap, since there is no
  // cursor here to do it. See ZoomHint.
  const zoomHint = useZoomHint();
  const zoomedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    zoomedIndexRef.current = zoomedIndex;
  }, [zoomedIndex]);

  const watchDrag = useCallback(
    () => zoomedIndexRef.current === null,
    [],
  );

  const TAP_MAX_DELAY = 300;
  const TAP_MAX_MOVE = 24;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number; index: number } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTapTimer = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  };
  // Cancel a pending single-tap-open timer if the component unmounts mid-wait.
  useEffect(() => clearTapTimer, []);

  const setZoomFromPoint = (
    container: HTMLElement,
    clientX: number,
    clientY: number,
    index: number,
  ) => {
    const rect = container.getBoundingClientRect();
    setZoomState({
      index,
      x: clientX - rect.left,
      y: clientY - rect.top,
      containerW: rect.width,
      containerH: rect.height,
    });
  };

  const handleImageTouchStart = (
    e: React.TouchEvent<HTMLDivElement>,
  ) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleImageTouchMove = (
    e: React.TouchEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (zoomedIndex !== index) return; // not zoomed - let embla swipe natively
    const touch = e.touches[0];
    if (!touch) return;
    setZoomFromPoint(e.currentTarget, touch.clientX, touch.clientY, index);
  };

  const handleImageTouchEnd = (
    e: React.TouchEvent<HTMLDivElement>,
    index: number,
  ) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = e.changedTouches[0];
    const moved = !start || !touch || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > TAP_MAX_MOVE;

    if (zoomedIndex === index) {
      // Zoom drag mode is scoped to a single pan gesture - the moment the
      // finger lifts (whether that was an actual pan or just a tap), it
      // turns back off. A fresh double-tap is what re-arms it.
      handleZoomLeave();
      setZoomedIndex(null);
      e.preventDefault();
      return;
    }

    if (moved || !touch) return; // real swipe/drag - leave it to embla

    // Every tap is handled ourselves (never the native click) so a second
    // tap can still be recognized as a double-tap instead of racing it.
    e.preventDefault();
    const now = currentTimeMs();
    const last = lastTapRef.current;
    const isDoubleTap =
      !!last &&
      last.index === index &&
      now - last.time < TAP_MAX_DELAY &&
      Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < TAP_MAX_MOVE;

    if (isDoubleTap) {
      clearTapTimer();
      lastTapRef.current = null;
      // The gesture just got used, so the hint has served its purpose -
      // drop the label for good rather than waiting out its timer.
      zoomHint.dismiss();
      setZoomedIndex(index);
      setZoomFromPoint(e.currentTarget, touch.clientX, touch.clientY, index);
      return;
    }

    lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY, index };
    clearTapTimer();
    tapTimerRef.current = setTimeout(() => {
      lastTapRef.current = null;
      openLightbox(index);
    }, TAP_MAX_DELAY);
  };

  const handleImageTouchCancel = () => {
    touchStartRef.current = null;
    handleZoomLeave();
  };

  const setApiAndListen = useCallback((newApi: CarouselApi) => {
    setApi(newApi);
    if (!newApi) return;
    setCurrent(newApi.selectedScrollSnap());
    newApi.on("select", () => {
      setCurrent(newApi.selectedScrollSnap());
    });
  }, []);

  // Videos play inline with native controls, so nothing stops one from
  // still running after a swipe/arrow moves the carousel away from it -
  // pause whatever isn't the current slide.
  useEffect(() => {
    videoElRefs.current.forEach((videoEl, idx) => {
      if (idx !== current) videoEl.pause();
    });
  }, [current]);

  // Changing slides via the arrows/thumbnail strip bypasses the touch
  // handlers (and their watchDrag guard), so a zoomed slide leaving view
  // needs to drop out of zoom mode here instead.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting derived zoom state when the slide changes, not deriving `current` itself
    setZoomedIndex((prev) => (prev !== null && prev !== current ? null : prev));
    setZoomState((prev) => (prev && prev.index !== current ? null : prev));
  }, [current]);

  const lastHandledTicket = useRef<number | undefined>(jumpTicket);

  useEffect(() => {
    if (!api) return;
    if (jumpTicket === undefined) return;
    if (lastHandledTicket.current === jumpTicket) return;
    lastHandledTicket.current = jumpTicket;
    if (!jumpToMediaId) return;
    const targetIndex = media.findIndex((m) => m.id === jumpToMediaId);
    if (targetIndex === -1) return;
    api.scrollTo(targetIndex);
  }, [api, jumpTicket, jumpToMediaId, media]);

  const openLightbox = (index: number) => {
    const videoEl = videoElRefs.current.get(index);
    if (videoEl) {
      // Hand off the exact playback moment, then pause the inline copy so
      // the two elements don't both play (and both output audio) at once.
      setVideoHandoff({
        index,
        time: videoEl.currentTime,
        playing: !videoEl.paused,
        muted: videoEl.muted,
      });
      videoEl.pause();
    } else {
      setVideoHandoff(null);
    }
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Reverse of the above: when the lightbox closes on a video, pick up
  // wherever it was left (time/play state/mute) on the inline element -
  // otherwise reopening the compact view would silently reset it to
  // whatever it happened to be when the visitor left it, not where the
  // fullscreen view left off.
  const handleVideoHandoffBack = (handoff: VideoHandoff) => {
    const videoEl = videoElRefs.current.get(handoff.index);
    if (!videoEl) return;
    videoEl.currentTime = handoff.time;
    videoEl.muted = handoff.muted;
    if (handoff.playing) videoEl.play().catch(() => {});
    else videoEl.pause();
  };

  if (media.length === 0) {
    return (
      <div className="w-full h-96 rounded-lg border flex items-center justify-center text-muted-foreground">
        No media available
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <Carousel
          setApi={setApiAndListen}
          className="w-full"
          opts={{
            loop: media.length > 1,
            // Swipe stays on by default; it's only turned off (via the ref
            // `watchDrag` reads) while a slide is in double-tap zoom mode, so
            // panning the lens there doesn't also drag the carousel.
            watchDrag,
          }}
        >
          <CarouselContent>
            {media.map((item, index) => {
              const isVideo = item.mediaType === "VIDEO";
              return (
                <CarouselItem key={item.id}>
                  <div
                    className={cn(
                      "relative w-full h-96 rounded-lg overflow-hidden border",
                      isVideo
                        ? "cursor-pointer"
                        : cn(
                            "cursor-zoom-in touch-manipulation",
                            zoomedIndex === index && "touch-none",
                          ),
                    )}
                    onClick={isVideo ? undefined : () => openLightbox(index)}
                    onMouseMove={
                      isVideo ? undefined : (e) => handleZoomMove(e, index)
                    }
                    onMouseLeave={isVideo ? undefined : handleZoomLeave}
                    onTouchStart={isVideo ? undefined : handleImageTouchStart}
                    onTouchMove={
                      isVideo ? undefined : (e) => handleImageTouchMove(e, index)
                    }
                    onTouchEnd={
                      isVideo ? undefined : (e) => handleImageTouchEnd(e, index)
                    }
                    onTouchCancel={isVideo ? undefined : handleImageTouchCancel}
                  >
                    {isVideo ? (
                      <>
                        {/* Plays inline like any other video - the fullscreen
                            lightbox is an explicit opt-in (the expand button
                            below), not the default click target, so it doesn't
                            fight the native play/pause/seek controls. */}
                        <video
                          ref={(el) => {
                            if (el) videoElRefs.current.set(index, el);
                            else videoElRefs.current.delete(index);
                          }}
                          src={item.url}
                          poster={item.thumbUrl ?? undefined}
                          controls
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 w-full h-full bg-black object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => openLightbox(index)}
                          aria-label="View fullscreen"
                          className="absolute top-2 right-2 z-10 cursor-pointer rounded-full bg-black/50 p-1.5 text-white transition-all duration-200 hover:bg-black/75 hover:scale-110"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {!loadedImages.has(index) && (
                          <div className="absolute inset-0 z-10 skeleton-shimmer" />
                        )}
                        <RetryImage
                          src={item.url}
                          alt={`${title} - image ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover"
                          priority={index === 0}
                          showShimmer={false}
                          ref={(img) => {
                            if (img?.complete && img.naturalWidth > 0)
                              markImageLoaded(index);
                          }}
                          onLoad={() => markImageLoaded(index)}
                          onError={(_e, willRetry) => {
                            if (!willRetry) markImageLoaded(index);
                          }}
                        />
                        {zoomState?.index === index &&
                          (() => {
                            const { x, y, containerW, containerH } = zoomState;
                            const lensX = Math.max(
                              0,
                              Math.min(
                                x - IMAGE_ZOOM_LENS_SIZE / 2,
                                containerW - IMAGE_ZOOM_LENS_SIZE,
                              ),
                            );
                            const lensY = Math.max(
                              0,
                              Math.min(
                                y - IMAGE_ZOOM_LENS_SIZE / 2,
                                containerH - IMAGE_ZOOM_LENS_SIZE,
                              ),
                            );
                            return (
                              <div
                                className="pointer-events-none absolute rounded-md border-2 border-white shadow-2xl overflow-hidden"
                                style={{
                                  left: lensX,
                                  top: lensY,
                                  width: IMAGE_ZOOM_LENS_SIZE,
                                  height: IMAGE_ZOOM_LENS_SIZE,
                                }}
                              >
                                <div
                                  className="relative"
                                  style={{
                                    position: "absolute",
                                    left: x - lensX - x * IMAGE_ZOOM_FACTOR,
                                    top: y - lensY - y * IMAGE_ZOOM_FACTOR,
                                    width: containerW * IMAGE_ZOOM_FACTOR,
                                    height: containerH * IMAGE_ZOOM_FACTOR,
                                  }}
                                >
                                  {/* Two layers on purpose.

                                      The lens used to hold only the sharp
                                      layer, whose `sizes` differs from the
                                      slide's - a different `sizes` makes Next
                                      pick a different srcset candidate, i.e. a
                                      different URL, which is NOT the one the
                                      browser already downloaded. So opening the
                                      lens started a fresh request for a large
                                      image (200vw on a phone) and, with the
                                      shimmer off, showed nothing until it
                                      landed - the ~1s of "square is here but
                                      nothing is zoomed" after a double tap.

                                      The base layer reuses the slide's exact
                                      `sizes`, so it is already in cache and
                                      paints on the same frame the lens opens -
                                      upscaled, hence soft. The sharp layer then
                                      fades in on top once it loads. */}
                                  <RetryImage
                                    src={item.url}
                                    alt=""
                                    fill
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    className="object-cover"
                                    showShimmer={false}
                                  />
                                  <RetryImage
                                    src={item.url}
                                    alt=""
                                    fill
                                    sizes="(max-width: 768px) 200vw, 100vw"
                                    className={cn(
                                      "object-cover transition-opacity duration-200",
                                      zoomHiResLoaded.has(index)
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                    showShimmer={false}
                                    ref={(img) => {
                                      if (img?.complete && img.naturalWidth > 0)
                                        markZoomHiResLoaded(index);
                                    }}
                                    onLoad={() => markZoomHiResLoaded(index)}
                                    onError={(_e, willRetry) => {
                                      if (!willRetry) markZoomHiResLoaded(index);
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        {/* Held back until the photo is actually painted -
                            advertising a zoom over a blank shimmer points at
                            nothing, and waiting lets the badge's entrance
                            animation land with the image. */}
                        {zoomHint.visible && loadedImages.has(index) && (
                          <ZoomHint
                            label={t("doubleTapToZoom")}
                            expanded={zoomHint.expanded}
                            muted={zoomedIndex === index}
                          />
                        )}
                      </>
                    )}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {media.length > 1 && (
            <>
              <CarouselPrevious className="left-2 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default" />
              <CarouselNext className="right-2 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default" />
            </>
          )}
        </Carousel>

        {media.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {media.map((item, index) => {
              const isVideo = item.mediaType === "VIDEO";
              const thumbSrc = getThumbSrc(item);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    api?.scrollTo(index);
                    setCurrent(index);
                  }}
                  className={cn(
                    "relative w-16 h-16 rounded border-2 overflow-hidden shrink-0 transition-all cursor-pointer",
                    current === index
                      ? "border-primary opacity-100"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  {!loadedThumbs.has(index) && (
                    <div className="absolute inset-0 z-10 skeleton-shimmer" />
                  )}
                  <RetryImage
                    src={thumbSrc}
                    alt={`${title} thumbnail ${index + 1}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    showShimmer={false}
                    ref={(img) => {
                      if (img?.complete && img.naturalWidth > 0)
                        markThumbLoaded(index);
                    }}
                    onLoad={() => markThumbLoaded(index)}
                    onError={(_e, willRetry) => {
                      if (!willRetry) markThumbLoaded(index);
                    }}
                  />
                  {isVideo && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                      <PlayCircle className="text-white" size={20} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <MediaLightbox
        media={media.map((m) => ({
          id: m.id,
          mediaType: m.mediaType,
          url: m.url,
          posterUrl: m.thumbUrl,
        }))}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        title={title}
        videoHandoff={videoHandoff}
        onVideoHandoffBack={handleVideoHandoffBack}
      />
    </>
  );
}

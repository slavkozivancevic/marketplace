"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RetryImage } from "@/components/RetryImage";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { MediaType } from "@/generated/prisma/client";

export interface LightboxMediaItem {
  /** Stable identity - used as React key and to remount on src swap. */
  id: string;
  mediaType: MediaType;
  /** Full-resolution image URL, or the video source URL. */
  url: string;
  /** Video poster frame; ignored for images. */
  posterUrl?: string | null;
  /** Pass true for `blob:` URLs that must bypass the Next image optimizer. */
  unoptimized?: boolean;
}

/**
 * One-shot handoff so expanding a video that's already playing inline (see
 * ProductImageCarousel's expand button) continues seamlessly - same time,
 * same play state, same mute state - instead of restarting from 0 and
 * falling back to the default muted-autoplay rule. Only ever applies to the
 * slide it names, and only once per open.
 */
export interface VideoHandoff {
  index: number;
  time: number;
  playing: boolean;
  muted: boolean;
}

/**
 * One video slide's playback, fully scoped to its own ref/effect - deliberately
 * NOT a shared ref-Map + effect on the parent. `<DialogContent>`'s subtree
 * (this component included) unmounts on close and remounts fresh on reopen,
 * so `appliedHandoff` correctly resets every time; a Map/ref living on the
 * parent `MediaLightbox` wouldn't (that component itself is never unmounted
 * by its caller - only Radix's Presence-controlled content inside it is),
 * which is why autoplay and the handoff previously only ever worked once
 * (or never at all, depending on timing) and a departed slide could keep
 * playing in the background after a swipe.
 */
function LightboxVideoSlide({
  item,
  isActive,
  handoff,
  registerRef,
}: {
  item: LightboxMediaItem;
  isActive: boolean;
  handoff: VideoHandoff | null;
  /** Lets the parent read this element's live state when the lightbox closes
   *  (for the fullscreen -> inline handoff) and pause it as a second,
   *  independent safety net when the active slide changes. */
  registerRef: (el: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const appliedHandoff = useRef(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!isActive) {
      el.pause();
      return;
    }
    if (!appliedHandoff.current && handoff) {
      appliedHandoff.current = true;
      el.currentTime = handoff.time;
      el.muted = handoff.muted;
      if (handoff.playing) el.play().catch(() => {});
      return;
    }
    // Belt-and-suspenders: React doesn't reliably apply the `muted` JSX
    // attribute as the DOM property in time for an immediate `.play()` on a
    // just-mounted <video> - set it imperatively right before playing so the
    // browser's "muted autoplay is always allowed" rule actually applies.
    el.muted = true;
    el.play().catch(() => {});
  }, [isActive, handoff]);

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        registerRef(el);
      }}
      src={item.url}
      poster={item.posterUrl ?? undefined}
      controls
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 w-full h-full object-contain bg-black"
    />
  );
}

interface MediaLightboxProps {
  media: LightboxMediaItem[];
  /** Index of the currently shown item (controlled). */
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible dialog title + image alt prefix. */
  title: string;
  videoHandoff?: VideoHandoff | null;
  /** Mirror of `videoHandoff` for the reverse direction: fired right before
   *  closing with the active video's live state, so the caller can hand it
   *  back to the inline player at the exact moment/play-state it was left at. */
  onVideoHandoffBack?: (handoff: VideoHandoff) => void;
}

/**
 * Fullscreen (95vw x 95vh) media viewer shared by the public product carousel
 * and the admin media-upload preview. Handles images and videos, with prev/next
 * navigation and dot indicators when more than one item is present.
 *
 * Slides run through the same embla-backed `<Carousel>` used everywhere else
 * in the app, so drag/swipe and the arrow buttons get the real animated slide
 * transition instead of a hard cut - a bespoke touch handler here previously
 * just swapped the index with no motion.
 *
 * Controlled: the parent owns `index`/`open` so it can decide which item the
 * user opened and react to close. Radix unmounts the dialog content on close,
 * so embla re-inits fresh (via `startIndex`) each time it opens.
 */
export function MediaLightbox({
  media,
  index,
  onIndexChange,
  open,
  onOpenChange,
  title,
  videoHandoff,
  onVideoHandoffBack,
}: MediaLightboxProps) {
  const count = media.length;
  const [api, setApi] = useState<CarouselApi>();

  // Shimmer per slide until its full-res image paints - same mechanics as the
  // inline gallery (see ProductImageCarousel): guarded so re-marking an
  // already-loaded index is a no-op, and the ref-callback `complete` check
  // catches images the browser already had cached before `onLoad` could fire.
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const markImageLoaded = useCallback((i: number) => {
    setLoadedImages((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }, []);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => onIndexChange(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onIndexChange]);

  // Registry of the currently-mounted video elements, keyed by slide index -
  // used for two things independent of each slide's own play/pause effect:
  // (1) a second, independent "pause whatever isn't active" pass whenever the
  // selected slide changes, and (2) reading the active video's live state the
  // moment the dialog closes, to hand it back to the inline player.
  const activeVideoRefs = useRef(new Map<number, HTMLVideoElement>());

  useEffect(() => {
    activeVideoRefs.current.forEach((el, i) => {
      if (i !== index) el.pause();
    });
  }, [index]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      const el = activeVideoRefs.current.get(index);
      if (el) {
        onVideoHandoffBack?.({
          index,
          time: el.currentTime,
          playing: !el.paused,
          muted: el.muted,
        });
        el.pause();
      }
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw]! w-[95vw] h-[95vh] p-0 gap-0 bg-background border-none overflow-hidden sm:max-w-[95vw]!"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative flex items-center justify-center w-full h-full">
          <button
            onClick={() => handleOpenChange(false)}
            className="absolute top-3 right-3 z-10 cursor-pointer rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <Carousel
            setApi={setApi}
            opts={{ loop: count > 1, startIndex: index }}
            className="relative w-full"
          >
            {/* Explicit viewport height (matches DialogContent's h-[95vh]) rather
                than a percentage - CarouselItem must stay a normal in-flow flex
                item for embla's slide math, which rules out `absolute inset-0`,
                and the un-stylable embla viewport div in between has no height
                of its own for a percentage to resolve against. */}
            <CarouselContent className="ml-0">
              {media.map((item, i) => (
                <CarouselItem
                  key={item.id}
                  className="relative h-[95vh] pl-0 cursor-pointer"
                >
                  {item.mediaType === "VIDEO" ? (
                    // Standardized rule: video only ever plays in this fullscreen
                    // view (the compact gallery is poster-only, click-to-open -
                    // see ProductImageCarousel), and here it always starts
                    // immediately, muted - autoplay-with-sound is blocked by
                    // browsers unpredictably, while muted autoplay is universally
                    // allowed. Controls stay visible so the visitor can unmute.
                    <LightboxVideoSlide
                      item={item}
                      isActive={i === index}
                      handoff={videoHandoff?.index === i ? videoHandoff : null}
                      registerRef={(el) => {
                        if (el) activeVideoRefs.current.set(i, el);
                        else activeVideoRefs.current.delete(i);
                      }}
                    />
                  ) : (
                    <>
                      {!loadedImages.has(i) && (
                        <div className="absolute inset-0 z-10 skeleton-shimmer" />
                      )}
                      <RetryImage
                        src={item.url}
                        alt={`${title} - ${i + 1}`}
                        fill
                        sizes="95vw"
                        className="object-contain"
                        unoptimized={item.unoptimized}
                        showShimmer={false}
                        ref={(img) => {
                          if (img?.complete && img.naturalWidth > 0)
                            markImageLoaded(i);
                        }}
                        onLoad={() => markImageLoaded(i)}
                        onError={(_e, willRetry) => {
                          if (!willRetry) markImageLoaded(i);
                        }}
                      />
                    </>
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>

            {count > 1 && (
              <>
                {/* Same shared arrow component (and its active:translate-y
                    press correction) as the inline gallery and every other
                    carousel in the app - identical look and feel, not a
                    hand-copied re-implementation. */}
                <CarouselPrevious className="left-3 size-11 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default [&_svg]:size-6" />
                <CarouselNext className="right-3 size-11 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default [&_svg]:size-6" />

                <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
                  {media.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => api?.scrollTo(i)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all cursor-pointer",
                        i === index ? "bg-white" : "bg-white/40",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </Carousel>
        </div>
      </DialogContent>
    </Dialog>
  );
}

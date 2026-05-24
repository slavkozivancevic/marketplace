"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, PlayCircle, X } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

export function ProductImageCarousel({
  media,
  title,
  jumpToMediaId,
  jumpTicket,
}: ProductImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
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

  const setApiAndListen = useCallback((newApi: CarouselApi) => {
    setApi(newApi);
    if (!newApi) return;
    setCurrent(newApi.selectedScrollSnap());
    newApi.on("select", () => {
      setCurrent(newApi.selectedScrollSnap());
    });
  }, []);

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
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const lightboxPrev = () =>
    setLightboxIndex((i) => (i - 1 + media.length) % media.length);
  const lightboxNext = () => setLightboxIndex((i) => (i + 1) % media.length);

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
          opts={{ loop: media.length > 1 }}
        >
          <CarouselContent>
            {media.map((item, index) => {
              const isVideo = item.mediaType === "VIDEO";
              return (
                <CarouselItem key={item.id}>
                  <div
                    className={cn(
                      "relative w-full h-96 rounded-lg overflow-hidden border",
                      // Videos use native controls - zoom-in/click-to-lightbox
                      // is image-only territory.
                      isVideo ? "" : "cursor-zoom-in",
                    )}
                    onClick={isVideo ? undefined : () => openLightbox(index)}
                    onMouseMove={
                      isVideo ? undefined : (e) => handleZoomMove(e, index)
                    }
                    onMouseLeave={isVideo ? undefined : handleZoomLeave}
                  >
                    {isVideo ? (
                      <video
                        src={item.url}
                        poster={item.thumbUrl ?? undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 w-full h-full bg-black object-contain"
                      />
                    ) : (
                      <>
                        {!loadedImages.has(index) && (
                          <div className="absolute inset-0 z-10 skeleton-shimmer" />
                        )}
                        <Image
                          src={item.url}
                          alt={`${title} - image ${index + 1}`}
                          fill
                          className="object-cover"
                          priority={index === 0}
                          onLoad={() =>
                            setLoadedImages((prev) => new Set(prev).add(index))
                          }
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
                                  <Image
                                    src={item.url}
                                    alt=""
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              </div>
                            );
                          })()}
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
                  <Image
                    src={thumbSrc}
                    alt={`${title} thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
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

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[95vw]! w-[95vw] h-[95vh] p-0 gap-0 bg-background border-none overflow-hidden sm:max-w-[95vw]!"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

          <div className="relative flex items-center justify-center w-full h-full">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 z-10 cursor-pointer rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative w-full h-full">
              {media[lightboxIndex] &&
                (media[lightboxIndex].mediaType === "VIDEO" ? (
                  <video
                    src={media[lightboxIndex].url}
                    poster={media[lightboxIndex].thumbUrl ?? undefined}
                    controls
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                ) : (
                  <Image
                    src={media[lightboxIndex].url}
                    alt={`${title} - image ${lightboxIndex + 1}`}
                    fill
                    className="object-contain"
                  />
                ))}
            </div>

            {media.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lightboxPrev}
                  className="absolute left-3 size-11 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 transition-[background-color,border-color,box-shadow,color] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:text-white hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lightboxNext}
                  className="absolute right-3 size-11 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 transition-[background-color,border-color,box-shadow,color] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:text-white hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>

                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all cursor-pointer",
                        i === lightboxIndex ? "bg-white" : "bg-white/40",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

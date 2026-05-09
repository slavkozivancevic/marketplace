"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

interface ProductImage {
  id: string;
  url: string;
}

interface ProductImageCarouselProps {
  images: ProductImage[];
  title: string;
  jumpToImageId?: string | null;
  jumpTicket?: number;
}

export function ProductImageCarousel({
  images,
  title,
  jumpToImageId,
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
    if (!jumpToImageId) return;
    const targetIndex = images.findIndex((img) => img.id === jumpToImageId);
    if (targetIndex === -1) return;
    api.scrollTo(targetIndex);
  }, [api, jumpTicket, jumpToImageId, images]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const lightboxPrev = () =>
    setLightboxIndex((i) => (i - 1 + images.length) % images.length);
  const lightboxNext = () => setLightboxIndex((i) => (i + 1) % images.length);

  if (images.length === 0) {
    return (
      <div className="w-full h-96 rounded-lg border flex items-center justify-center text-muted-foreground">
        No images available
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <Carousel setApi={setApiAndListen} className="w-full">
          <CarouselContent>
            {images.map((img, index) => (
              <CarouselItem key={img.id}>
                <div
                  className="relative w-full h-96 rounded-lg overflow-hidden border cursor-zoom-in"
                  onClick={() => openLightbox(index)}
                  onMouseMove={(e) => handleZoomMove(e, index)}
                  onMouseLeave={handleZoomLeave}
                >
                  {!loadedImages.has(index) && (
                    <div className="absolute inset-0 z-10 skeleton-shimmer" />
                  )}
                  <Image
                    src={img.url}
                    alt={`${title} - image ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                    onLoad={() => setLoadedImages((prev) => new Set(prev).add(index))}
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
                              src={img.url}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {images.length > 1 && (
            <>
              {/*
                disabled:pointer-events-auto keeps the arrow button catching
                clicks even when it's at the end of the carousel — otherwise
                the click falls through to the image underneath and opens
                the lightbox, which the user never asked for.
              */}
              <CarouselPrevious className="left-2 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default" />
              <CarouselNext className="right-2 active:translate-y-[calc(-50%+1px)] disabled:pointer-events-auto disabled:cursor-default" />
            </>
          )}
        </Carousel>

        {images.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, index) => (
              <button
                key={img.id}
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
                  src={img.url}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </button>
            ))}
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
              {images[lightboxIndex] && (
                <Image
                  src={images[lightboxIndex].url}
                  alt={`${title} - image ${lightboxIndex + 1}`}
                  fill
                  className="object-contain"
                />
              )}
            </div>

            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lightboxPrev}
                  className="absolute left-3 text-white bg-black/40 hover:bg-black/60 hover:text-white rounded-full"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={lightboxNext}
                  className="absolute right-3 text-white bg-black/40 hover:bg-black/60 hover:text-white rounded-full"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>

                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {images.map((_, i) => (
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

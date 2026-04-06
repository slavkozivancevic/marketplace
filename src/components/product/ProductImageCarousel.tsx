"use client";

import { useState, useCallback } from "react";
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

interface ProductImage {
  id: string;
  url: string;
}

interface ProductImageCarouselProps {
  images: ProductImage[];
  title: string;
}

export function ProductImageCarousel({
  images,
  title,
}: ProductImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const setApiAndListen = useCallback(
    (newApi: CarouselApi) => {
      setApi(newApi);
      if (!newApi) return;
      setCurrent(newApi.selectedScrollSnap());
      newApi.on("select", () => {
        setCurrent(newApi.selectedScrollSnap());
      });
    },
    [],
  );

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const lightboxPrev = () =>
    setLightboxIndex((i) => (i - 1 + images.length) % images.length);
  const lightboxNext = () =>
    setLightboxIndex((i) => (i + 1) % images.length);

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
                >
                  <Image
                    src={img.url}
                    alt={`${title} - image ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {images.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
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
          className="max-w-5xl w-full p-0 bg-black/95 border-none overflow-hidden"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

          <div className="relative flex items-center justify-center h-[85vh]">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 z-10 cursor-pointer rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative w-full h-full">
              <Image
                src={images[lightboxIndex].url}
                alt={`${title} - image ${lightboxIndex + 1}`}
                fill
                className="object-contain"
              />
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

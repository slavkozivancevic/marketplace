"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

interface MediaLightboxProps {
  media: LightboxMediaItem[];
  /** Index of the currently shown item (controlled). */
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible dialog title + image alt prefix. */
  title: string;
}

/**
 * Fullscreen (95vw x 95vh) media viewer shared by the public product carousel
 * and the admin media-upload preview. Handles images and videos, with prev/next
 * navigation and dot indicators when more than one item is present.
 *
 * Controlled: the parent owns `index`/`open` so it can decide which item the
 * user opened and react to close.
 */
export function MediaLightbox({
  media,
  index,
  onIndexChange,
  open,
  onOpenChange,
  title,
}: MediaLightboxProps) {
  const count = media.length;
  const current = media[index];

  const prev = () => onIndexChange((index - 1 + count) % count);
  const next = () => onIndexChange((index + 1) % count);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw]! w-[95vw] h-[95vh] p-0 gap-0 bg-background border-none overflow-hidden sm:max-w-[95vw]!"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative flex items-center justify-center w-full h-full">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-10 cursor-pointer rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative w-full h-full">
            {current &&
              (current.mediaType === "VIDEO" ? (
                <video
                  key={current.id}
                  src={current.url}
                  poster={current.posterUrl ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              ) : (
                <Image
                  key={current.id}
                  src={current.url}
                  alt={`${title} - ${index + 1}`}
                  fill
                  sizes="95vw"
                  className="object-contain"
                  unoptimized={current.unoptimized}
                />
              ))}
          </div>

          {count > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={prev}
                className="absolute left-3 size-11 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 transition-[background-color,border-color,box-shadow,color] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:text-white hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={next}
                className="absolute right-3 size-11 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 transition-[background-color,border-color,box-shadow,color] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:text-white hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {media.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => onIndexChange(i)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all cursor-pointer",
                      i === index ? "bg-white" : "bg-white/40",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
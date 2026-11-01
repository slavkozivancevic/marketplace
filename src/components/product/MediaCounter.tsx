"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface MediaCounterProps {
  /** Zero-based index of the item on screen. */
  index: number;
  total: number;
  className?: string;
  /**
   * Say the new position to a screen reader on every change. On for galleries
   * the visitor moves through; off for the product card's hover cycle, which
   * turns on its own and would talk over everything else on the page.
   */
  announce?: boolean;
  /** The item on screen is a video: its native controls own the bottom edge,
   *  so the pill moves to the top instead of covering the seek bar. */
  overVideo?: boolean;
}

/**
 * "2 of 6" under a gallery's image, wherever images can be paged: the product
 * page, the quick view, the fullscreen lightbox and the product card's hover
 * cycle. One pill per gallery, pinned over the slides (not inside one), so it
 * stays put while the slides move. Same look as `ZoomHint`, which sits in the
 * bottom-left corner - this one is centred and never collides with it.
 * Nothing for a single image: "1 of 1" says nothing.
 */
export function MediaCounter({
  index,
  total,
  className,
  announce = true,
  overVideo = false,
}: MediaCounterProps) {
  const t = useTranslations("products");
  if (total < 2) return null;
  return (
    <div
      aria-live={announce ? "polite" : undefined}
      aria-hidden={announce ? undefined : true}
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white tabular-nums shadow-sm backdrop-blur-[2px]",
        overVideo ? "top-2" : "bottom-2",
        className,
      )}
    >
      {t("mediaCounter", { current: index + 1, total })}
    </div>
  );
}

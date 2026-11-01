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
 * "2 of 6" under a gallery that shows ALL of a product's media: the product
 * page, the quick view and the fullscreen lightbox. One pill per gallery,
 * pinned over the slides. In the lightbox it is the only position marker (it
 * replaced the dots there); the inline galleries keep their thumbnails.
 *
 * Deliberately not on the product card: the listing loads at most five images
 * per product (`take: 5` in publicProducts.ts) while a product may have up to
 * ten (MAX_FILES), so a card would say "1 of 5" about a product that has ten.
 * Its dots stay - they show what the card has without claiming a total.
 *
 * Same look as `ZoomHint`. Nothing for a single image: "1 of 1" says nothing.
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

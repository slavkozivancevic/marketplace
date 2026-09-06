"use client";

import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import { useTranslations } from "next-intl";
import { ProductCard } from "@/features/products/components/ProductCard";
import type { SerializedProductListItem } from "@/types/types";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { padForLoop } from "@/lib/carouselLoop";

// Carousels render the exact same storefront card as the products grid and the
// wishlist (single source: <ProductCard>). The data is a full product list
// item; each strip fetches just one media frame so the shared card shows a
// static still (no hover cycling) - lighter for these secondary strips.
export type RelatedProduct = SerializedProductListItem;

const carouselArrow =
  "absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 flex items-center justify-center transition-[background-color,border-color,box-shadow,color,opacity] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] cursor-pointer active:translate-y-[calc(-50%+1px)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]";

function CarouselArrows() {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } =
    useCarousel();

  return (
    <>
      <button
        type="button"
        onClick={scrollPrev}
        aria-label="Previous"
        className={cn(
          carouselArrow,
          "left-0 -translate-x-4",
          canScrollPrev
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        aria-label="Next"
        className={cn(
          carouselArrow,
          "right-0 translate-x-4",
          canScrollNext
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  );
}

export function RelatedProductsCarousel({
  products,
  eyebrow,
  title,
  showViewAll = true,
  autoplay: enableAutoplay = true,
}: {
  products: RelatedProduct[];
  /** Override the default "Discover more" eyebrow (e.g. for Recently viewed). */
  eyebrow?: string;
  /** Override the default "You may also like" heading. */
  title?: string;
  /** Hide the "View all" link (e.g. for personalized strips). */
  showViewAll?: boolean;
  /**
   * Disable carousel autoplay. Defaults to on for historical reasons, but the
   * product page passes `false` everywhere except "You may also like": exactly
   * one strip on a page should move on its own. New call sites should opt out.
   */
  autoplay?: boolean;
}) {
  const t = useTranslations("relatedProducts");
  const autoplayRef = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true }),
  );

  if (products.length === 0) return null;

  return (
    <section className="w-full border-t border-border/50 bg-muted/20">
      <div className="py-12 px-6 lg:px-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {eyebrow ?? t("discoverMore")}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              {title ?? t("youMayAlsoLike")}
            </h2>
          </div>
          {showViewAll && (
            <Link
              href="/products"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              {t("viewAll")}
            </Link>
          )}
        </div>

        {/* Carousel */}
        {/*
          Drag behaviour, and why it is this exact pair of options.

          `dragFree` is OFF: with it a swipe kept its momentum and stopped
          wherever friction ran out, leaving cards half-cut at the left edge, a
          different result every time and nothing like what the arrows do.
          Snapping plus `align: "start"` lands the slide flush left, so a swipe
          and an arrow click finish in the same place.

          `skipSnaps` is ON because snapping alone felt like the carousel bit
          down the instant you let go. That is not the settle animation - it is
          embla's `allowedForce`, which without this flag clamps the release to
          exactly ONE slide no matter how hard you flick. Over that distance
          there is no room for deceleration to be visible. With it, force
          carries across several slides and the glide reads as momentum, still
          landing on a snap.

          The settle speed itself is not tunable: embla hardcodes
          `baseSpeed = dragFree ? 43 : 25` and `friction = 0.68`, and the
          `duration` option applies only to programmatic scrolls (the arrows).
        */}
        <Carousel
          opts={{ loop: true, align: "start", skipSnaps: true }}
          plugins={enableAutoplay ? [autoplayRef.current] : []}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {/* Padded so embla's native loop has enough slide width to build
                a real seamless wrap (see padForLoop) - only ever matters for
                strips with few items, since real content already clears the
                bar on its own. */}
            {padForLoop(products).map((product, index) => (
              <CarouselItem
                key={`${product.id}-${index}`}
                className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
              >
                <ProductCard product={product} />
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselArrows />
        </Carousel>
      </div>
    </section>
  );
}
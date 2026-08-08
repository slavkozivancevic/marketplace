"use client";

import axios from "axios";
import React, { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { ImageOff, ShoppingCart, ChevronDown, X, Video as VideoIcon, Award } from "lucide-react";

import { HoverImageCycler } from "@/components/product/HoverImageCycler";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { Button } from "@/components/ui/button";
import { SerializedProductListItem } from "@/types/types";
import {
  getProductTitle,
  getProductDescription,
  getProductShortDescription,
} from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import { StarRating } from "@/features/reviews/components/StarRating";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";

// ---------- Rating breakdown popover ----------

type RatingBreakdown = Record<number, number>;

function RatingBreakdownPopover({
  productId,
  productSlug,
  avgRating,
  ratingCount,
}: {
  productId: string;
  productSlug: string;
  avgRating: number;
  ratingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("products");

  const { data } = useQuery<RatingBreakdown>({
    queryKey: ["product", "rating-breakdown", productId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/products/${productId}`);
      return data.ratingBreakdown as RatingBreakdown;
    },
    enabled: open,
    staleTime: 1000 * 60 * 10,
  });

  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : ratingCount;

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-0.5 cursor-pointer group/rating"
          onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setOpen((p) => !p); }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          aria-label="Show rating breakdown"
        >
          <StarRating rating={avgRating} size={14} />
          <span className="text-xs text-muted-foreground ml-1">
            {avgRating.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({ratingCount})
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5 cursor-pointer group-hover/rating:text-foreground transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 space-y-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {/* Close button */}
        <button
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2">
          <StarRating rating={avgRating} size={15} />
          <span className="text-sm font-semibold">{avgRating.toFixed(1)} {t("outOf5")}</span>
        </div>
        <p className="text-xs text-muted-foreground">{ratingCount} {t("globalRatings")}</p>

        {/* Breakdown bars */}
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = data?.[star] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8 shrink-0">{star} ★</span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                    style={{ width: open ? `${pct}%` : "0%" }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Link to reviews */}
        <Link
          href={{
            pathname: "/products/[slug]",
            params: { slug: productSlug },
            hash: "reviews",
          }}
          className="text-xs text-primary hover:underline block pt-1"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {t("seeCustomerReviews")} &rsaquo;
        </Link>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Product card ----------

/**
 * The single storefront product card, shared by the products grid, the
 * wishlist, and the related / frequently-bought / recently-viewed carousels.
 *
 * - Hover image cycling is data-driven: feed multiple `media` (grid) to cycle
 *   on hover, or a single one (carousels) for a static still - no extra prop.
 * - The add-to-cart button only renders when `onQuickView` is supplied. The
 *   grid passes it; the wishlist and carousels omit it (Amazon-style browse
 *   strips are click-through only).
 */
export function ProductCard({
  product,
  onQuickView,
}: {
  product: SerializedProductListItem;
  onQuickView?: (id: string) => void;
}) {
  const { currency, currentRate } = useCurrencyStore();
  const locale = useLocale();
  const tCart = useTranslations("cart");
  const tProducts = useTranslations("products");
  const localTitle = getProductTitle(product, locale);
  const localShortDescription = getProductShortDescription(product, locale);
  const localDescription = getProductDescription(product, locale);
  const localBrandName = product.brand ? getBrandName(product.brand, locale) : "";
  // Prefer shortDescription on the card; fall back to full description.
  const cardDescription = localShortDescription ?? localDescription;
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const productSlug =
    product.translations.find((tr) => tr.locale === locale)?.slug ??
    product.translations.find((tr) => tr.locale === "en")?.slug ??
    "";

  return (
    <div className="relative h-full">
      <Link
        href={{ pathname: "/products/[slug]", params: { slug: productSlug } }}
        className="block h-full"
      >
        <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50 pt-0 pb-0 gap-0 flex flex-col">
          <CardHeader className="p-0 relative">
            {(() => {
              // Card hero cycles through every media item: images use their
              // url, videos use their poster (thumbUrl). Slots backed by a
              // video are tracked so the cycler can overlay a play icon when
              // the cycle lands on them - making the video discoverable on
              // hover without auto-playing on every tile.
              const hoverUrls: string[] = [];
              const videoIndexes = new Set<number>();
              product.media.forEach(
                (m: { url: string; thumbUrl: string | null; mediaType: "IMAGE" | "VIDEO" }) => {
                  if (m.mediaType === "VIDEO") {
                    const poster = m.thumbUrl ?? m.url;
                    videoIndexes.add(hoverUrls.length);
                    hoverUrls.push(poster);
                  } else {
                    hoverUrls.push(m.url);
                  }
                },
              );
              const hasVideo = videoIndexes.size > 0;

              if (hoverUrls.length === 0) {
                return (
                  <div className="w-full h-48 rounded-t flex flex-col items-center justify-center gap-2 bg-muted/50">
                    <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground/40">No image</span>
                  </div>
                );
              }
              return (
                <div className="relative w-full h-48">
                  <HoverImageCycler
                    images={hoverUrls}
                    videoIndexes={videoIndexes}
                    alt={localTitle}
                    className="w-full h-48 rounded-t"
                  />
                  {hasVideo && (
                    <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
                      <VideoIcon className="h-3 w-3" />
                      Video
                    </div>
                  )}
                </div>
              );
            })()}
            {(isOnSale || product.isBestseller) && (
              <div className="absolute top-3 left-0 flex flex-col items-start gap-1 pointer-events-none">
                {isOnSale && (
                  <span className="bg-linear-to-r from-red-500 to-rose-600 text-white text-sm font-black px-4 py-1.5 rounded-r-full shadow-lg shadow-red-500/50 tracking-wider uppercase">
                    -{Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)}%
                  </span>
                )}
                {product.isBestseller && (
                  <span className="flex items-center gap-1 bg-linear-to-r from-amber-500 to-orange-500 text-white text-xs font-black px-3 py-1 rounded-r-full shadow-lg shadow-amber-500/50 tracking-wider uppercase">
                    <Award className="h-3 w-3" />
                    {tProducts("bestsellerBadge")}
                  </span>
                )}
              </div>
            )}
            {product.brand && (
              <div className="absolute top-2 right-2 pointer-events-none">
                <div className="flex items-center gap-2 bg-background/85 backdrop-blur-xs border border-border/60 rounded-full px-2.5 py-1.5 shadow-sm">
                  <BrandLogo
                    src={product.brand.logoUrl}
                    srcDark={product.brand.logoUrlDark}
                    backdrop={product.brand.logoBackdrop}
                    backdropDark={product.brand.logoBackdropDark}
                    name={localBrandName}
                    size={20}
                    shape="circle"
                  />
                  <span className="text-xs font-semibold leading-none">{localBrandName}</span>
                </div>
              </div>
            )}
            <WishlistButton
              productId={product.id}
              size={16}
              className="absolute bottom-2 right-2"
            />
          </CardHeader>
          <CardContent className="pt-3 pb-3 flex flex-col flex-1">
            <div className="flex-1">
              <TruncatedTooltip content={localTitle}>
                <CardTitle className="text-sm leading-snug line-clamp-2">{localTitle}</CardTitle>
              </TruncatedTooltip>
              {cardDescription && (
                <TruncatedTooltip content={cardDescription}>
                  <CardDescription className="line-clamp-2 mt-0.5">{cardDescription}</CardDescription>
                </TruncatedTooltip>
              )}
              {product.ratingCount > 0 && (
                <div className="mt-1.5" onClick={(e) => e.preventDefault()}>
                  <RatingBreakdownPopover
                    productId={product.id}
                    productSlug={productSlug}
                    avgRating={product.avgRating}
                    ratingCount={product.ratingCount}
                  />
                </div>
              )}
              {isOnSale ? (
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-lg font-semibold text-red-500">
                    {formatPrice(convertCents(product.price, currency, currentRate()), currency)}
                  </p>
                  <p className="text-sm text-muted-foreground line-through">
                    {formatPrice(convertCents(product.compareAtPrice!, currency, currentRate()), currency)}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-semibold mt-2">
                  {formatPrice(convertCents(product.price, currency, currentRate()), currency)}
                </p>
              )}
            </div>
            {onQuickView && (
              <Button
                size="sm"
                className="w-full gap-1.5 mt-3"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickView(product.id);
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {tCart("addToCartShort")}
              </Button>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

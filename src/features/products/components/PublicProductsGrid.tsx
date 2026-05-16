"use client";
import axios from "axios";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { ImageOff, ShoppingCart, ChevronDown, X } from "lucide-react";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useInfiniteVirtualGrid } from "@/components/infinite/useInfiniteVirtualGrid";
import { HoverImageCycler } from "@/components/product/HoverImageCycler";
import { SkeletonProductGridCard } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { SerializedProductListItem } from "@/types/types";
import { StarRating } from "@/features/reviews/components/StarRating";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { GRID_PAGE_SIZE, MAX_PAGES } from "@/constants/queryConstants";
import type { ProductFilters } from "@/lib/query/searchParams";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { QuickViewModal } from "./QuickViewModal";
import { Button } from "@/components/ui/button";

function buildFetcher(filters: ProductFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<SerializedProductListItem>> => {
    // Read rate at fetch time so we always use the current value without
    // making it part of the query key (which would cause spurious refetches
    // while rates are loading).
    const rate = useCurrencyStore.getState().currentRate();
    const params = new URLSearchParams();
    params.set("take", String(GRID_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    // filters.minPrice/maxPrice are in the display currency; convert to USD
    // here so the API's decimalToCents() produces the correct cent value.
    if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice / rate));
    if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice / rate));
    if (filters.onSale === true) params.set("onSale", "true");
    if (filters.isDigital != null) params.set("isDigital", String(filters.isDigital));
    for (const id of filters.brandId) params.append("brandId", id);
    if (filters.minRating != null) params.set("minRating", String(filters.minRating));
    if (filters.dept) params.set("dept", filters.dept);

    const { data } = await axios.get(`/api/products?${params.toString()}`);
    return data;
  };
}

// ---------- Rating breakdown popover ----------

type RatingBreakdown = Record<number, number>;

function RatingBreakdownPopover({
  productId,
  avgRating,
  ratingCount,
}: {
  productId: string;
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
          href={`/products/${productId}#reviews`}
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

function ProductCard({
  product,
  onQuickView,
}: {
  product: SerializedProductListItem;
  onQuickView: (id: string) => void;
}) {
  const { currency, currentRate } = useCurrencyStore();
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <div className="relative h-full">
      <Link href={`/products/${product.id}`} className="block h-full">
        <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50 pt-0 pb-0 gap-0 flex flex-col">
          <CardHeader className="p-0 relative">
            {product.images.length > 0 ? (
              <HoverImageCycler
                images={product.images.map((img: { url: string }) => img.url)}
                alt={product.title}
                className="w-full h-48 rounded-t"
              />
            ) : (
              <div className="w-full h-48 rounded-t flex flex-col items-center justify-center gap-2 bg-muted/50">
                <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground/40">No image</span>
              </div>
            )}
            {isOnSale && (
              <div className="absolute top-3 left-0 flex flex-col items-start gap-1 pointer-events-none">
                <span className="bg-linear-to-r from-red-500 to-rose-600 text-white text-sm font-black px-4 py-1.5 rounded-r-full shadow-lg shadow-red-500/50 tracking-wider uppercase">
                  -{Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)}%
                </span>
              </div>
            )}
            {product.brand && (
              <div className="absolute top-2 right-2 pointer-events-none">
                {product.brand.logoUrl ? (
                  <div className="flex items-center gap-2 bg-background/85 backdrop-blur-sm border border-border/60 rounded-full px-2.5 py-1.5 shadow-sm">
                    <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-border/40 bg-white">
                      <Image
                        src={product.brand.logoUrl}
                        alt={product.brand.name}
                        fill
                        sizes="20px"
                        className="object-contain"
                      />
                    </div>
                    <span className="text-xs font-semibold leading-none">{product.brand.name}</span>
                  </div>
                ) : (
                  <div className="bg-background/85 backdrop-blur-sm border border-border/60 rounded-full px-2.5 py-1.5 shadow-sm">
                    <span className="text-xs font-semibold leading-none">{product.brand.name}</span>
                  </div>
                )}
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
              <CardTitle className="text-sm leading-snug line-clamp-2">{product.title}</CardTitle>
              <CardDescription className="line-clamp-2 mt-0.5">{product.description}</CardDescription>
              {product.ratingCount > 0 && (
                <div className="mt-1.5" onClick={(e) => e.preventDefault()}>
                  <RatingBreakdownPopover
                    productId={product.id}
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
              Add to Cart
            </Button>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

export function PublicProductsGrid({
  filters,
  scrollContainerRef,
}: {
  filters: ProductFilters;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("products");
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  // Include currency in the query key so that switching currency triggers a
  // fresh fetch with the correct rate (buildFetcher reads it imperatively).
  const { currency } = useCurrencyStore();

  const {
    parentRef,
    virtualizer,
    items,
    query,
    columnCount,
    columnCountReady,
    gap,
    getRowItems,
    isSentinelRow,
    isPlaceholderData,
  } = useInfiniteVirtualGrid<SerializedProductListItem>({
    queryKey: ["products", "public", filters, currency],
    queryFn: buildFetcher(filters),
    minCardWidth: 280,
    gap: 24,
    estimateRowHeight: 380,
    maxPages: MAX_PAGES,
    scrollContainerRef,
    // Public listings reflect cross-tenant product status changes (publish /
    // unpublish / archive). Server actions revalidate the Next route, but the
    // queryKey on the client includes `currency` while the SSR prefetch does
    // not, so hydration never carries new data into this cache. Force a
    // refetch on every mount so a soft-nav back to /products after a status
    // change always reflects the latest state.
    refetchOnMount: "always",
  });

  const skeletonCount = columnCountReady ? Math.max(6, columnCount * 2) : 12;

  // Show skeletons while loading AND while keepPreviousData is showing stale
  // results from a previous query key (filter/currency change). This prevents
  // the "flash of old empty results → No products" when the previous query
  // returned nothing.
  if (query.status === "pending" || isPlaceholderData) {
    return (
      <div ref={parentRef} className={cn("@container", !scrollContainerRef && "flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]")}>
        <div className="grid grid-cols-1 @[584px]:grid-cols-2 @[888px]:grid-cols-3 @[1192px]:grid-cols-4 @[1496px]:grid-cols-5 @[1800px]:grid-cols-6 gap-6">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonProductGridCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("errorLoading")}</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    const hasFilters = filters.search || filters.minPrice != null || filters.maxPrice != null;
    return (
      <Alert>
        <AlertTitle>{hasFilters ? t("noProductsFound") : t("noProductsAvailable")}</AlertTitle>
        <AlertDescription>
          {hasFilters ? t("tryAdjusting") : t("checkBackLater")}
        </AlertDescription>
      </Alert>
    );
  }

  const renderCard = (product: SerializedProductListItem) => (
    <ProductCard key={product.id} product={product} onQuickView={setQuickViewId} />
  );

  // Small dataset — plain CSS grid, no virtualization overhead or blank space.
  if (!query.hasNextPage) {
    return (
      <>
        <div ref={parentRef} className={cn("@container", !scrollContainerRef && "flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}>
          {!columnCountReady ? (
            <div className="grid grid-cols-1 @[584px]:grid-cols-2 @[888px]:grid-cols-3 @[1192px]:grid-cols-4 @[1496px]:grid-cols-5 @[1800px]:grid-cols-6 gap-6">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonProductGridCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
              {items.map(renderCard)}
            </div>
          )}
        </div>
        <QuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
      </>
    );
  }

  // Large dataset — virtualized scroll container.
  return (
    <>
      <div
        ref={parentRef}
        className={cn("@container", !scrollContainerRef && "flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      >
        {!columnCountReady ? (
          <div className="grid grid-cols-1 @[584px]:grid-cols-2 @[888px]:grid-cols-3 @[1192px]:grid-cols-4 @[1496px]:grid-cols-5 @[1800px]:grid-cols-6 gap-6">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonProductGridCard key={i} />
            ))}
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              if (isSentinelRow(vRow.index)) {
                return (
                  <div
                    key="sentinel"
                    ref={virtualizer.measureElement}
                    data-index={vRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vRow.start}px)`,
                      display: "grid",
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      gap: `${gap}px`,
                    }}
                  >
                    {Array.from({ length: columnCount }).map((_, i) => (
                      <SkeletonProductGridCard key={i} />
                    ))}
                  </div>
                );
              }

              const rowItems = getRowItems(vRow.index);
              return (
                <div
                  key={vRow.key}
                  ref={virtualizer.measureElement}
                  data-index={vRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`,
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    gap: `${gap}px`,
                  }}
                >
                  {rowItems.map(renderCard)}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <QuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
    </>
  );
}
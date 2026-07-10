"use client";
import axios from "axios";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import React, { useState } from "react";
import { useInfiniteVirtualGrid } from "@/components/infinite/useInfiniteVirtualGrid";
import { SkeletonProductGridCard } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductListItem } from "@/types/types";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";
import type { ProductFilters } from "@/lib/query/searchParams";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import { useCurrencyStore, getCurrentRate } from "@/store/currency";
import { QuickViewModal } from "./QuickViewModal";
import { ProductCard } from "./ProductCard";

function buildFetcher(filters: ProductFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<SerializedProductListItem>> => {
    // Read rate at fetch time so we always use the current value without
    // making it part of the query key (which would cause spurious refetches
    // while rates are loading).
    const rate = getCurrentRate();
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
    if (filters.attrs) params.set("attrs", filters.attrs);

    const { data } = await axios.get(`/api/products?${params.toString()}`);
    return data;
  };
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
    scrollContainerRef,
    // Public listings reflect cross-tenant changes (publish/unpublish/archive,
    // media edits). The SSR prefetch now uses this exact key (currency included),
    // so a product mutation's revalidatePath re-runs the page RSC and hydration
    // carries the fresh list into this cache on navigation. `refetchOnMount`
    // stays as a safety net for cases hydration can't cover (e.g. a filtered
    // view whose prefetch only seeded the unfiltered page).
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

  // Small dataset - plain CSS grid, no virtualization overhead or blank space.
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

  // Large dataset - virtualized scroll container.
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
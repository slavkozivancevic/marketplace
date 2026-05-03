"use client";
import axios from "axios";

import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

import React from "react";
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
import { SerializedProductListItem } from "@/types/types";
import { StarRating } from "@/features/reviews/components/StarRating";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { GRID_PAGE_SIZE, MAX_PAGES } from "@/constants/queryConstants";
import type { ProductFilters } from "@/lib/query/searchParams";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";

function buildFetcher(filters: ProductFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<SerializedProductListItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(GRID_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice));
    if (filters.onSale === true) params.set("onSale", "true");
    if (filters.isDigital != null) params.set("isDigital", String(filters.isDigital));
    for (const id of filters.brandId) params.append("brandId", id);

    const { data } = await axios.get(`/api/products?${params.toString()}`);
    return data;
  };
}

function ProductCard({ product }: { product: SerializedProductListItem }) {
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <Link href={`/products/${product.id}`} className="block group">
      <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
        <CardHeader className="p-0 relative">
          {product.images.length > 0 ? (
            <HoverImageCycler
              images={product.images.map((img) => img.url)}
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
        <CardContent className="pt-4">
          <CardTitle>{product.title}</CardTitle>
          <CardDescription>{product.description}</CardDescription>
          {product.ratingCount > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <StarRating rating={Math.round(product.avgRating)} size={14} />
              <span className="text-xs text-muted-foreground">
                {product.avgRating.toFixed(1)} ({product.ratingCount})
              </span>
            </div>
          )}
          {isOnSale ? (
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-lg font-semibold text-red-500">
                ${product.price.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground line-through">
                ${product.compareAtPrice!.toFixed(2)}
              </p>
            </div>
          ) : (
            <p className="text-lg font-semibold mt-2">
              ${product.price.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function PublicProductsGrid({
  filters,
  scrollContainerRef,
}: {
  filters: ProductFilters;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
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
    queryKey: ["products", "public", filters],
    queryFn: buildFetcher(filters),
    minCardWidth: 280,
    gap: 24,
    estimateRowHeight: 340,
    maxPages: MAX_PAGES,
    scrollContainerRef,
  });

  const skeletonCount = columnCountReady ? Math.max(6, columnCount * 2) : 12;

  if (query.status === "pending") {
    return (
      <div ref={parentRef} className={scrollContainerRef ? undefined : "@container flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]"}>
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
        <AlertTitle>Error loading products</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    const hasFilters = filters.search || filters.minPrice != null || filters.maxPrice != null;
    return (
      <Alert>
        <AlertTitle>{hasFilters ? "No products found" : "No products available"}</AlertTitle>
        <AlertDescription>
          {hasFilters
            ? "Try adjusting your search or filters."
            : "Check back later for new products."}
        </AlertDescription>
      </Alert>
    );
  }

  // Small dataset — plain CSS grid, no virtualization overhead or blank space.
  if (!query.hasNextPage) {
    return (
      <div ref={parentRef} className={cn(scrollContainerRef ? undefined : "@container flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}>
        {!columnCountReady ? (
          <div className="grid grid-cols-1 @[584px]:grid-cols-2 @[888px]:grid-cols-3 @[1192px]:grid-cols-4 @[1496px]:grid-cols-5 @[1800px]:grid-cols-6 gap-6">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonProductGridCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Large dataset — virtualized scroll container.
  return (
    <div
      ref={parentRef}
      className={cn(scrollContainerRef ? undefined : "@container flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
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
                {rowItems.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


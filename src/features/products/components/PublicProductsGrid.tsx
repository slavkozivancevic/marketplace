"use client";

import Link from "next/link";
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

    const res = await fetch(`/api/products?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to fetch products (${res.status}): ${body}`);
    }
    return res.json();
  };
}

function ProductCard({ product }: { product: SerializedProductListItem }) {
  return (
    <Link href={`/products/${product.id}`} className="block group">
      <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
        {product.images.length > 0 && (
          <CardHeader className="p-0">
            <HoverImageCycler
              images={product.images.map((img) => img.url)}
              alt={product.title}
              className="w-full h-48 rounded-t"
            />
          </CardHeader>
        )}
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
          <p className="text-lg font-semibold mt-2">
            ${product.price.toFixed(2)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function PublicProductsGrid({ filters }: { filters: ProductFilters }) {
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
  } = useInfiniteVirtualGrid<SerializedProductListItem>({
    queryKey: ["products", "public", filters],
    queryFn: buildFetcher(filters),
    minCardWidth: 280,
    gap: 24,
    estimateRowHeight: 340,
    maxPages: MAX_PAGES,
  });

  if (query.status === "pending") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonProductGridCard key={i} />
        ))}
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
      <div ref={parentRef}>
        {!columnCountReady ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonProductGridCard key={i} />
            ))}
          </div>
        ) : (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }}
        >
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
      className="overflow-auto"
      style={{ maxHeight: "calc(100vh - 220px)" }}
    >
      {!columnCountReady ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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

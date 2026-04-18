"use client";

import { useInfiniteVirtualGrid } from "@/components/infinite/useInfiniteVirtualGrid";
import { MyProductCard } from "./MyProductCard";
import { SkeletonProductGridCard } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductListItem } from "@/types/types";
import { GRID_PAGE_SIZE, MAX_PAGES } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import type { MyProductFilters } from "@/lib/query/searchParams";

function buildFetcher(filters: MyProductFilters) {
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
    for (const s of filters.status) params.append("status", s);

    const res = await fetch(`/api/dashboard/my-products?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch products");
    return res.json();
  };
}

function renderCard(
  product: SerializedProductListItem,
  canWrite: boolean,
) {
  return (
    <MyProductCard
      key={product.id}
      canWrite={canWrite}
      product={{
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
        status: product.status,
        imageUrls: product.images?.map((img) => img.url) ?? [],
        brand: product.brand ?? null,
      }}
    />
  );
}

export function MyProductsGrid({
  canWrite,
  filters,
}: {
  canWrite: boolean;
  filters?: MyProductFilters;
}) {
  const defaultFilters: MyProductFilters = {
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    status: [],
  };
  const f = filters ?? defaultFilters;

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
    queryKey: ["products", "my-products", f],
    queryFn: buildFetcher(f),
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
    const hasFilters = f.search || f.status.length > 0;
    return hasFilters ? (
      <Alert>
        <AlertTitle>No products found</AlertTitle>
        <AlertDescription>
          Try adjusting your search or filters.
        </AlertDescription>
      </Alert>
    ) : (
      <p className="text-muted-foreground">
        No products yet.{canWrite ? " Create your first product!" : ""}
      </p>
    );
  }

  // Small dataset — plain CSS grid, no virtualization overhead or blank space.
  if (!query.hasNextPage) {
    return (
      <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto">
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
            {items.map((product) => renderCard(product, canWrite))}
            {query.isFetchingNextPage &&
              Array.from({ length: columnCount }).map((_, i) => (
                <SkeletonProductGridCard key={`skel-${i}`} />
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
      className="flex-1 min-h-0 overflow-auto"
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
                {rowItems.map((product) => renderCard(product, canWrite))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
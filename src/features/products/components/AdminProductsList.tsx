"use client";

import { cn } from "@/lib/utils";

import { useInfiniteVirtualList } from "@/components/infinite/useInfiniteVirtualList";
import { ProductTableHeader, ProductTableRow } from "./ProductTable";
import { SkeletonProductTableRow } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE, MAX_PAGES } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import type { AdminProductFilters } from "@/lib/query/searchParams";

function buildFetcher(filters: AdminProductFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<SerializedProductListItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    for (const s of filters.status) params.append("status", s);
    if (filters.minPrice != null)
      params.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice != null)
      params.set("maxPrice", String(filters.maxPrice));
    for (const id of filters.brandId) params.append("brandId", id);

    const res = await fetch(`/api/admin/products?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch products");
    return res.json();
  };
}

export function AdminProductsList({
  filters,
}: {
  filters?: AdminProductFilters;
}) {
  const defaultFilters: AdminProductFilters = {
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    status: [],
    minPrice: null,
    maxPrice: null,
    brandId: [],
  };
  const f = filters ?? defaultFilters;

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<SerializedProductListItem>({
      queryKey: ["products", "admin", f],
      queryFn: buildFetcher(f),
      estimateSize: 73,
      maxPages: MAX_PAGES,
    });

  if (query.status === "pending") {
    return (
      <div role="table" className="rounded-lg border">
        <ProductTableHeader showActions />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonProductTableRow key={i} showActions />
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
    const hasFilters =
      f.search || f.status.length > 0 || f.minPrice != null || f.maxPrice != null || f.brandId != null;
    return (
      <Alert>
        <AlertTitle>
          {hasFilters ? "No products found" : "No products yet"}
        </AlertTitle>
        <AlertDescription>
          {hasFilters
            ? "Try adjusting your search or filters."
            : "There are currently no products to display."}
        </AlertDescription>
      </Alert>
    );
  }

  // Small dataset — render rows directly without virtualization.
  if (!query.hasNextPage) {
    return (
      <div
        role="table"
        className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      >
        <ProductTableHeader showActions />
        {items.map((product) => (
          <ProductTableRow key={product.id} product={product} showActions />
        ))}
      </div>
    );
  }

  // Large dataset — virtualized scroll container.
  return (
    <div
      role="table"
      className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      ref={parentRef}
    >
      <ProductTableHeader showActions />
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((vRow) => {
          if (isSentinelIndex(vRow.index)) {
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
                }}
              >
                <SkeletonProductTableRow showActions />
              </div>
            );
          }

          const product = items[vRow.index];
          return (
            <div
              key={product.id}
              ref={virtualizer.measureElement}
              data-index={vRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <ProductTableRow product={product} showActions />
            </div>
          );
        })}
      </div>
    </div>
  );
}
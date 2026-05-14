"use client";
import axios from "axios";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useInfiniteVirtualList } from "@/components/infinite/useInfiniteVirtualList";
import { ProductTableHeader, ProductTableRow } from "./ProductTable";
import { SkeletonProductTableRow } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE, MAX_PAGES } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import type { MyProductFilters } from "@/lib/query/searchParams";
import { useCurrencyStore } from "@/store/currency";

function buildFetcher(filters: MyProductFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<SerializedProductListItem>> => {
    const rate = useCurrencyStore.getState().currentRate();
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    for (const s of filters.status) params.append("status", s);
    if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice / rate));
    if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice / rate));
    for (const id of filters.brandId) params.append("brandId", id);

    const { data } = await axios.get(`/api/dashboard/my-products?${params.toString()}`);
    return data;
  };
}

export function MyProductsList({
  canWrite,
  filters,
}: {
  canWrite: boolean;
  filters?: MyProductFilters;
}) {
  const t = useTranslations("products");
  const defaultFilters: MyProductFilters = {
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    status: [],
    minPrice: null,
    maxPrice: null,
    brandId: [],
  };
  const f = filters ?? defaultFilters;
  const { currency } = useCurrencyStore();

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<SerializedProductListItem>({
      queryKey: ["products", "my-products", f, currency],
      queryFn: buildFetcher(f),
      estimateSize: 73,
      maxPages: MAX_PAGES,
    });

  if (query.status === "pending") {
    return (
      <div role="table" className="rounded-lg border">
        <ProductTableHeader showActions={canWrite} />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonProductTableRow key={i} showActions={canWrite} />
        ))}
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
    const hasFilters = f.search || f.status.length > 0;
    return (
      <Alert>
        <AlertTitle>
          {hasFilters ? t("noProductsFound") : t("noProductsYet")}
        </AlertTitle>
        <AlertDescription>
          {hasFilters ? t("tryAdjusting") : t("checkBackLater")}
        </AlertDescription>
      </Alert>
    );
  }

  // Small dataset — render rows directly without virtualization.
  if (!query.hasNextPage) {
    return (
      <div
        role="table"
        className={cn(
          "rounded-lg border flex-1 min-h-0 overflow-auto",
          isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150",
        )}
      >
        <ProductTableHeader showActions={canWrite} />
        {items.map((product) => (
          <ProductTableRow
            key={product.id}
            product={product}
            showActions={canWrite}
            basePath="/dashboard/my-products"
          />
        ))}
      </div>
    );
  }

  // Large dataset — virtualized scroll container.
  return (
    <div
      role="table"
      className={cn(
        "rounded-lg border flex-1 min-h-0 overflow-auto",
        isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150",
      )}
      ref={parentRef}
    >
      <ProductTableHeader showActions={canWrite} />
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
                <SkeletonProductTableRow showActions={canWrite} />
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
              <ProductTableRow
                product={product}
                showActions={canWrite}
                basePath="/dashboard/my-products"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
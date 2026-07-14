"use client";
import axios from "axios";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useInfiniteVirtualList } from "@/components/infinite/useInfiniteVirtualList";
import { ProductTableHeader, ProductTableRow } from "./ProductTable";
import { SkeletonProductTableRow } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import type { MyProductFilters } from "@/lib/query/searchParams";
import { useCurrencyStore, getCurrentRate } from "@/store/currency";
import { useActiveOrgId } from "@/features/organizations/components/ActiveOrgContext";

function buildFetcher(filters: MyProductFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<SerializedProductListItem>> => {
    const rate = getCurrentRate();
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
  const orgId = useActiveOrgId();

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<SerializedProductListItem>({
      queryKey: ["products", "my-products", orgId, f, currency],
      queryFn: buildFetcher(f),
      estimateSize: 73,
      // SSR prefetch uses ["products","my-products",filters] (no currency),
      // so hydration cannot push fresh data into this cache after a server
      // revalidatePath. Refetch on every mount so status changes show up
      // immediately on soft-nav back.
      refetchOnMount: "always",
    });

  // Lock the whole table while any row has an action (edit nav / duplicate /
  // delete) in flight, to prevent racing actions on other rows.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const handleBusyChange = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      if (busy === prev.has(id)) return prev;
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const anyRowBusy = busyIds.size > 0;
  const tableLocked = isPlaceholderData || anyRowBusy;

  if (query.status === "pending") {
    return (
      <div role="table" className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
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

  // Small dataset - render rows directly without virtualization.
  if (!query.hasNextPage) {
    return (
      <div
        role="table"
        className={cn(
          "rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]",
          tableLocked && "opacity-60 pointer-events-none transition-opacity duration-150",
        )}
      >
        <ProductTableHeader showActions={canWrite} />
        {items.map((product) => (
          <ProductTableRow
            key={product.id}
            product={product}
            showActions={canWrite}
            basePath="/dashboard/my-products"
            onBusyChange={handleBusyChange}
          />
        ))}
      </div>
    );
  }

  // Large dataset - virtualized scroll container.
  return (
    <div
      role="table"
      className={cn(
        "rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]",
        tableLocked && "opacity-60 pointer-events-none transition-opacity duration-150",
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
                onBusyChange={handleBusyChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
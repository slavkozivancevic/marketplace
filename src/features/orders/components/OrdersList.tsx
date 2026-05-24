"use client";
import axios from "axios";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useInfiniteVirtualList } from "@/components/infinite/useInfiniteVirtualList";
import { OrderTableRow } from "./OrderTableRow";
import { SkeletonOrderRow } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import type { UserOrderListItem } from "../db/orders";
import { LIST_PAGE_SIZE, MAX_PAGES } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import type { OrderFilters } from "@/lib/query/searchParams";

function buildFetcher(filters: OrderFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<UserOrderListItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    if (filters.status.length > 0)
      params.set("status", filters.status.join(","));

    const { data } = await axios.get(`/api/dashboard/orders?${params.toString()}`);
    return data;
  };
}

function OrderTableHeader({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div
      role="row"
      className="grid grid-cols-[100px_100px_80px_minmax(200px,2fr)_120px_120px] items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
    >
      <div role="columnheader">{t("orders.orderId")}</div>
      <div role="columnheader">{t("orders.date")}</div>
      <div role="columnheader">{t("orders.time")}</div>
      <div role="columnheader">{t("orders.items")}</div>
      <div role="columnheader">{t("orders.yourTotal")}</div>
      <div role="columnheader">{t("orders.status")}</div>
    </div>
  );
}

export function OrdersList({ filters }: { filters?: OrderFilters }) {
  const t = useTranslations();

  const defaultFilters: OrderFilters = {
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    status: [],
  };
  const f = filters ?? defaultFilters;

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<UserOrderListItem>({
      queryKey: ["orders", "user", f],
      queryFn: buildFetcher(f),
      estimateSize: 56,
      maxPages: MAX_PAGES,
    });

  if (query.status === "pending") {
    return (
      <div role="table" className="rounded-lg border">
        <OrderTableHeader t={t} />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonOrderRow key={i} />
        ))}
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("orders.error")}</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    const hasFilters = f.search || f.status.length > 0;
    return (
      <Alert>
        <AlertTitle>{hasFilters ? t("orders.noOrders") : t("orders.noOrdersYet")}</AlertTitle>
        <AlertDescription>
          {hasFilters ? (
            t("orders.tryAdjusting")
          ) : (
            <>
              {t("orders.noneYetDesc")}{" "}
              <Link href="/products" className="underline">
                {t("orders.browse")}
              </Link>
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Small dataset - render rows directly without virtualization.
  if (!query.hasNextPage) {
    return (
      <div
        role="table"
        className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      >
        <OrderTableHeader t={t} />
        {items.map((order) => (
          <OrderTableRow key={order.id} order={order} />
        ))}
      </div>
    );
  }

  // Large dataset - virtualized scroll container.
  return (
    <div
      role="table"
      className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      ref={parentRef}
    >
      <OrderTableHeader t={t} />
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
                <SkeletonOrderRow />
              </div>
            );
          }

          const order = items[vRow.index];
          return (
            <div
              key={order.id}
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
              <OrderTableRow order={order} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
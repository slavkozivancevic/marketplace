"use client";

import axios from "axios";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useInfiniteVirtualList } from "@/components/infinite/useInfiniteVirtualList";
import { OrgOrderTableRow } from "./OrgOrderTableRow";
import { SkeletonOrderRow } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import type { OrgOrderListItem } from "../db/orgOrders";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import type { OrgOrderFilters } from "@/lib/query/searchParams";

function buildFetcher(filters: OrgOrderFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<OrgOrderListItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    if (filters.status.length > 0) params.set("status", filters.status.join(","));
    const { data } = await axios.get(`/api/dashboard/org-orders?${params.toString()}`);
    return data;
  };
}

const COL = "grid-cols-[100px_100px_80px_minmax(180px,2fr)_140px_120px_170px]";

function OrgOrderTableHeader({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div
      role="row"
      className={`grid ${COL} items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit`}
    >
      <div role="columnheader">{t("orderId")}</div>
      <div role="columnheader">{t("date")}</div>
      <div role="columnheader">{t("time")}</div>
      <div role="columnheader">{t("items")}</div>
      <div role="columnheader">{t("buyer")}</div>
      <div role="columnheader" className="text-right">{t("subtotal")}</div>
      <div role="columnheader" className="text-center">{t("status")}</div>
    </div>
  );
}

export function OrgOrdersList({ filters }: { filters?: OrgOrderFilters }) {
  const t = useTranslations("orgOrders");

  const defaultFilters: OrgOrderFilters = {
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    status: [],
  };
  const f = filters ?? defaultFilters;

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<OrgOrderListItem>({
      queryKey: ["orders", "org", f],
      queryFn: buildFetcher(f),
      estimateSize: 56,
    });

  if (query.status === "pending") {
    return (
      <div role="table" className="rounded-lg border">
        <OrgOrderTableHeader t={t} />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonOrderRow key={i} />
        ))}
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("error")}</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    const hasFilters = f.search || f.status.length > 0;
    return (
      <Alert>
        <AlertTitle>{hasFilters ? t("noOrdersFiltered") : t("noOrdersYet")}</AlertTitle>
        <AlertDescription>
          {hasFilters ? t("tryAdjusting") : (
            <>
              {t("noOrdersYetDesc")}{" "}
              <Link href="/dashboard/my-products" className="underline">
                {t("viewProducts")}
              </Link>
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Small dataset - no virtualization needed
  if (!query.hasNextPage) {
    return (
      <div
        role="table"
        className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      >
        <OrgOrderTableHeader t={t} />
        {items.map((order) => (
          <OrgOrderTableRow key={order.id} order={order} />
        ))}
      </div>
    );
  }

  // Large dataset - virtualized
  return (
    <div
      role="table"
      className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}
      ref={parentRef}
    >
      <OrgOrderTableHeader t={t} />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          if (isSentinelIndex(vRow.index)) {
            return (
              <div
                key="sentinel"
                ref={virtualizer.measureElement}
                data-index={vRow.index}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
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
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
            >
              <OrgOrderTableRow order={order} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
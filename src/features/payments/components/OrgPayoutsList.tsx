"use client";

import axios from "axios";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useInfiniteVirtualList } from "@/components/infinite/useInfiniteVirtualList";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import type { OrgPayoutListItem } from "../db/payouts";
import type { OrgPayoutFilters } from "@/lib/query/searchParams";
import { OrgPayoutTableRow } from "./OrgPayoutTableRow";
import { OrgPayoutSkeletonRow, PAYOUT_COL } from "./OrgPayoutTableSkeleton";
import { useActiveOrgId } from "@/features/organizations/components/ActiveOrgContext";

function buildFetcher(filters: OrgPayoutFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<OrgPayoutListItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (filters.search) params.set("search", filters.search);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    if (filters.status.length > 0) params.set("status", filters.status.join(","));
    if (filters.refunded.length > 0) params.set("refunded", filters.refunded.join(","));
    const { data } = await axios.get(`/api/dashboard/payouts?${params.toString()}`);
    return data;
  };
}

function PayoutTableHeader({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div
      role="row"
      className={cn(
        "grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
        PAYOUT_COL,
      )}
    >
      <div role="columnheader">{t("orderShort")}</div>
      <div role="columnheader">{t("date")}</div>
      <div role="columnheader">{t("time")}</div>
      <div role="columnheader" className="text-right">{t("amount")}</div>
      <div role="columnheader" className="text-center">{t("status")}</div>
    </div>
  );
}

export function OrgPayoutsList({
  filters,
  scrollResetToken,
}: {
  filters: OrgPayoutFilters;
  scrollResetToken?: number;
}) {
  const t = useTranslations("payouts");
  const orgId = useActiveOrgId();

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<OrgPayoutListItem>({
      queryKey: ["payouts", "org", orgId, filters],
      queryFn: buildFetcher(filters),
      estimateSize: 56,
      resetScrollKey: scrollResetToken,
    });

  if (query.status === "pending") {
    return (
      <div role="table" className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
        <PayoutTableHeader t={t} />
        {Array.from({ length: 8 }).map((_, i) => (
          <OrgPayoutSkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("loadError")}</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    const hasFilters =
      filters.search || filters.status.length > 0 || filters.refunded.length > 0;
    return (
      <Alert>
        <AlertTitle>{hasFilters ? t("noPayoutsFiltered") : t("noPayouts")}</AlertTitle>
        {hasFilters && <AlertDescription>{t("tryAdjusting")}</AlertDescription>}
      </Alert>
    );
  }

  // Small dataset - no virtualization needed.
  if (!query.hasNextPage) {
    return (
      <div
        role="table"
        className={cn(
          "rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]",
          isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150",
        )}
        ref={parentRef}
      >
        <PayoutTableHeader t={t} />
        {items.map((payout) => (
          <OrgPayoutTableRow key={payout.id} payout={payout} />
        ))}
      </div>
    );
  }

  // Large dataset - virtualized, auto-fetches the next page near the tail.
  return (
    <div
      role="table"
      className={cn(
        "rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]",
        isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150",
      )}
      ref={parentRef}
    >
      <PayoutTableHeader t={t} />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const style = {
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${vRow.start}px)`,
          };
          if (isSentinelIndex(vRow.index)) {
            return (
              <div key="sentinel" ref={virtualizer.measureElement} data-index={vRow.index} style={style}>
                <OrgPayoutSkeletonRow />
              </div>
            );
          }
          const payout = items[vRow.index];
          return (
            <div key={payout.id} ref={virtualizer.measureElement} data-index={vRow.index} style={style}>
              <OrgPayoutTableRow payout={payout} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

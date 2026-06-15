"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Refresh every order-related view after a mutation that changes an order's
 * status or its returns. Invalidates the cached TanStack queries - the buyer and
 * seller lists AND their disjunctive status-filter counts - so the count badges
 * update immediately instead of lingering until the next navigation. Also calls
 * router.refresh() for the (uncached) server-rendered order detail pages.
 *
 * Query families touched:
 *   ["orders", ...]      buyer/seller lists + buyer counts
 *   ["org-orders", ...]  seller counts
 *   ["payouts", ...]     payout list + counts (a refund changes them)
 */
export function useRefreshOrderViews() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["org-orders"] });
    queryClient.invalidateQueries({ queryKey: ["payouts"] });
    router.refresh();
  }, [queryClient, router]);
}

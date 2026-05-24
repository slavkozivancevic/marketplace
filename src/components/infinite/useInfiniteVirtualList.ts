"use client";

import { useEffect, useRef } from "react";
import {
  useInfiniteQuery,
  keepPreviousData,
  type QueryKey,
  type InfiniteData,
} from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

export type InfinitePage<TItem> = {
  items: TItem[];
  nextCursor?: string;
};

type Options<TItem> = {
  queryKey: QueryKey;
  queryFn: (ctx: { pageParam: string | undefined }) => Promise<InfinitePage<TItem>>;
  /** Estimated row height in px (the virtualizer will measure actual heights). */
  estimateSize?: number;
  overscan?: number;
  /** Cap the in-memory cache. Older pages are evicted as the user scrolls deeper. */
  maxPages?: number;
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
};

/**
 * Combines useInfiniteQuery with a vertical row virtualizer.
 * Auto-fetches the next page as the tail row scrolls into the overscan window.
 *
 * Caller owns the scroll container - attach `parentRef` to it and render
 * `virtualizer.getVirtualItems()` inside an absolutely positioned spacer div
 * sized by `virtualizer.getTotalSize()`.
 */
export function useInfiniteVirtualList<TItem>({
  queryKey,
  queryFn,
  estimateSize = 64,
  overscan = 8,
  maxPages = 5,
  enabled = true,
  staleTime,
  refetchOnMount,
}: Options<TItem>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery<
    InfinitePage<TItem>,
    Error,
    InfiniteData<InfinitePage<TItem>>,
    QueryKey,
    string | undefined
  >({
    queryKey,
    queryFn: ({ pageParam }) => queryFn({ pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    maxPages,
    enabled,
    ...(staleTime !== undefined && { staleTime }),
    ...(refetchOnMount !== undefined && { refetchOnMount }),
  });

  const items: TItem[] =
    query.data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = items.length + (query.hasNextPage ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  // Auto-fetch next page when the tail row enters the overscan window.
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItemIndex = virtualItems[virtualItems.length - 1]?.index;
  useEffect(() => {
    if (lastVirtualItemIndex == null) return;
    if (
      lastVirtualItemIndex >= items.length - 1 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      query.fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lastVirtualItemIndex,
    items.length,
    query.hasNextPage,
    query.isFetchingNextPage,
  ]);

  return {
    parentRef,
    virtualizer,
    items,
    query,
    isPlaceholderData: query.isPlaceholderData,
    /** True for the trailing virtual row that represents the load-more sentinel. */
    isSentinelIndex: (index: number) => index >= items.length,
  };
}

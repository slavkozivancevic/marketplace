"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  keepPreviousData,
  type QueryKey,
  type InfiniteData,
} from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { InfinitePage } from "./useInfiniteVirtualList";

type Options<TItem> = {
  queryKey: QueryKey;
  queryFn: (ctx: { pageParam: string | undefined }) => Promise<InfinitePage<TItem>>;
  /** Minimum desired card width in px. Used to compute column count from container width. */
  minCardWidth?: number;
  /** Gap between cards in px. */
  gap?: number;
  /** Estimated row height (image + content). The virtualizer measures actual heights too. */
  estimateRowHeight?: number;
  overscan?: number;
  maxPages?: number;
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  /**
   * When provided, this element is used as the virtualizer's scroll container
   * instead of parentRef. parentRef still measures column width via ResizeObserver.
   */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
};

/**
 * Combines useInfiniteQuery with a vertical row virtualizer where each
 * virtual row contains N grid items. Column count is derived from the
 * scroll container's width via ResizeObserver.
 *
 * Caller renders rows like:
 *
 * ```tsx
 * <div ref={parentRef} className="overflow-auto h-...">
 *   <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
 *     {virtualizer.getVirtualItems().map(vRow => {
 *       const rowItems = getRowItems(vRow.index);
 *       return (
 *         <div
 *           key={vRow.key}
 *           ref={virtualizer.measureElement}
 *           data-index={vRow.index}
 *           style={{
 *             position: "absolute", top: 0, left: 0, width: "100%",
 *             transform: `translateY(${vRow.start}px)`,
 *             display: "grid",
 *             gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
 *             gap,
 *           }}
 *         >
 *           {rowItems.map(item => renderItem(item))}
 *         </div>
 *       );
 *     })}
 *   </div>
 * </div>
 * ```
 */
export function useInfiniteVirtualGrid<TItem>({
  queryKey,
  queryFn,
  minCardWidth = 280,
  gap = 24,
  estimateRowHeight = 340,
  overscan = 4,
  maxPages = 5,
  enabled = true,
  staleTime,
  refetchOnMount,
  scrollContainerRef,
}: Options<TItem>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [columnCountReady, setColumnCountReady] = useState(false);

  // Callback ref instead of useLayoutEffect([minCardWidth, gap]) so that column
  // count is re-measured every time the element is attached to the DOM.
  // useLayoutEffect with static deps only runs once on mount; when filters change
  // the query goes through a "pending" state that renders without parentRef,
  // setting parentRef.current = null. When data arrives the element is
  // re-attached but useLayoutEffect would not re-fire, leaving columnCount at 1.
  const parentRefCallback = useCallback(
    (el: HTMLDivElement | null) => {
      (parentRef as { current: HTMLDivElement | null }).current = el;
      if (!el) return;

      const update = (width: number) => {
        const cols = Math.max(
          1,
          Math.floor((width + gap) / (minCardWidth + gap)),
        );
        setColumnCount((prev) => (prev === cols ? prev : cols));
        setColumnCountReady(true);
      };

      update(el.clientWidth);
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          update(entry.contentRect.width);
        }
      });
      observer.observe(el);
      // React calls this callback with null on unmount, which disconnects the
      // observer via the closure — no explicit cleanup needed here.
    },
    [minCardWidth, gap],
  );

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
  const itemRowCount = Math.ceil(items.length / columnCount);
  const totalRowCount = itemRowCount + (query.hasNextPage ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalRowCount,
    getScrollElement: () => scrollContainerRef?.current ?? parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  // When column count changes (resize), all row positions shift.
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnCount]);

  // Auto-fetch next page on tail.
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItemIndex = virtualItems[virtualItems.length - 1]?.index;
  useEffect(() => {
    if (lastVirtualItemIndex == null) return;
    if (
      lastVirtualItemIndex >= itemRowCount - 1 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      query.fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lastVirtualItemIndex,
    itemRowCount,
    query.hasNextPage,
    query.isFetchingNextPage,
  ]);

  const getRowItems = (rowIndex: number): TItem[] => {
    const start = rowIndex * columnCount;
    return items.slice(start, start + columnCount);
  };

  return {
    parentRef: parentRefCallback as unknown as React.RefObject<HTMLDivElement>,
    virtualizer,
    items,
    query,
    isPlaceholderData: query.isPlaceholderData,
    columnCount,
    columnCountReady,
    gap,
    itemRowCount,
    getRowItems,
    isSentinelRow: (rowIndex: number) => rowIndex >= itemRowCount,
  };
}
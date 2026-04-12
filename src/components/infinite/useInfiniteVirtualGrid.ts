"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
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
}: Options<TItem>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  // Observe parent width to compute column count.
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const update = (width: number) => {
      const usable = width;
      const cols = Math.max(
        1,
        Math.floor((usable + gap) / (minCardWidth + gap)),
      );
      setColumnCount((prev) => (prev === cols ? prev : cols));
    };

    update(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minCardWidth, gap]);

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
    maxPages,
    enabled,
  });

  const items: TItem[] =
    query.data?.pages.flatMap((p) => p.items) ?? [];
  const itemRowCount = Math.ceil(items.length / columnCount);
  const totalRowCount = itemRowCount + (query.hasNextPage ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalRowCount,
    getScrollElement: () => parentRef.current,
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
    parentRef,
    virtualizer,
    items,
    query,
    columnCount,
    gap,
    itemRowCount,
    getRowItems,
    isSentinelRow: (rowIndex: number) => rowIndex >= itemRowCount,
  };
}

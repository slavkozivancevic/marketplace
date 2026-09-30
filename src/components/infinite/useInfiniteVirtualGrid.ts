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
 *           ref={measureRow}
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
  maxPages,
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
      // observer via the closure - no explicit cleanup needed here.
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
    // Only window when a cap is explicitly requested. Without it, react-query
    // evicts the oldest page on forward scroll, which makes already-seen items
    // vanish and the list visibly reshuffle. Virtualization keeps the DOM small
    // regardless, so for our catalog sizes keeping all loaded pages is correct.
    ...(maxPages !== undefined && { maxPages }),
    enabled,
    ...(staleTime !== undefined && { staleTime }),
    ...(refetchOnMount !== undefined && { refetchOnMount }),
  });

  const items: TItem[] =
    query.data?.pages.flatMap((p) => p.items) ?? [];
  const itemRowCount = Math.ceil(items.length / columnCount);
  const totalRowCount = itemRowCount + (query.hasNextPage ? 1 : 0);

  /*
    The estimate cannot be made right, so it is made invisible instead.

    A virtualizer positions every row it has not measured yet from
    `estimateSize`, measures them, then corrects. Card height is not knowable in
    advance - it moves with the column count, the translated copy, whether a
    product has a rating row or a struck-through sale price - so the estimate is
    always wrong by something, and that correction is what the eye catches: the
    visible GAP between row 1 and row 2 jumping (measured at 9px, then settling
    to the real 24px) while the row heights themselves never changed.

    Tuning the constant only shrinks the jump. `rowsMeasured` removes it: the
    caller keeps its skeleton on screen until the first real row has reported a
    height, by which point every position is derived from measurement rather
    than from a guess. The grid stays MOUNTED and only faded out underneath
    that skeleton - a transparent box still lays out, and laying out is what
    produces the measurement being waited on. It must be faded and not hidden;
    `SkeletonVirtualGridCover` has the reason.

    It is a one-way latch on purpose. Resetting it on a width change sounds
    right - the old measurements no longer describe the new layout - but it
    would pull the skeleton back over a grid the user is actively resizing.
    Worse, the reset was written as an effect, so it ran AFTER the ref callback
    that had just set the flag in the same commit: the first paint latched
    false, and nothing re-fires a stable ref to set it again.
  */
  const [rowsMeasured, setRowsMeasured] = useState(false);

  const virtualizer = useVirtualizer({
    count: totalRowCount,
    getScrollElement: () => scrollContainerRef?.current ?? parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    // Vertical spacing between virtual rows. The `gap` inside each row's grid
    // style only spaces columns (a row is a single line of cards), so without
    // this the measured rows stack flush - the non-virtualized small-catalog
    // branch uses `gap-6` and the two must look identical.
    gap,
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

  // Read inside the ref callback, which must not be re-created per render (a
  // new identity makes React detach and re-attach every row).
  const itemRowCountRef = useRef(itemRowCount);
  itemRowCountRef.current = itemRowCount;

  /**
   * Attach to each row instead of `virtualizer.measureElement`. It does
   * everything that does, and additionally flips `rowsMeasured` once a row of
   * PRODUCTS has reported a real height - the signal the caller waits on
   * before revealing the grid.
   *
   * The sentinel row is deliberately not a signal. It is the tail placeholder
   * for the next page, so it sits below everything already loaded - typically
   * far below the fold - and it attaches before the item rows do. Letting it
   * count is what put an empty column on screen: the skeleton was taken away
   * on the strength of a row the user could not see, leaving the page
   * background where the products were about to be.
   */
  const measureRow = useCallback(
    (el: HTMLElement | null) => {
      virtualizer.measureElement(el);
      if (!el) return;
      const index = Number(el.getAttribute("data-index"));
      if (!(index < itemRowCountRef.current)) return;
      // `> 1` rather than `> 0`: a row caught mid-layout reports a hairline
      // height, and treating that as measured would reveal the grid one frame
      // too early - exactly the jump this exists to prevent.
      if (el.getBoundingClientRect().height > 1) setRowsMeasured(true);
    },
    [virtualizer],
  );

  return {
    parentRef: parentRefCallback as unknown as React.RefObject<HTMLDivElement>,
    virtualizer,
    measureRow,
    // Measured AND currently rendering at least one row of products. The
    // second half matters on the first commit of the virtualized branch: the
    // virtualizer has no scroll rect yet, so it hands back an empty window (or
    // the sentinel alone) while the wrapper already carries its full height.
    // Revealing then paints an empty column.
    rowsMeasured: rowsMeasured && virtualItems.some((v) => v.index < itemRowCount),
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
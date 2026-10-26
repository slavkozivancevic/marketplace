"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type ScrollAreaProps = {
  children: React.ReactNode;
  /** The viewport - the element that actually scrolls. A virtualizer's `getScrollElement` and any `scrollTo` go here. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * How the content box lays out its children. `block` (default) stacks them
   * at the viewport's width. `column` makes it a flex column at least as tall
   * as the viewport, for content that relies on `flex-1` - a footer pushed to
   * the bottom of a short page.
   */
  layout?: "block" | "column";
  /** Fades the content and blocks clicks while an action or a refetch is in flight. */
  locked?: boolean;
  /** Classes for the root - size it here (`flex-1 min-h-0`, a border). */
  className?: string;
  /** Classes for the viewport - `@container`, a height cap, an ARIA role's styling. */
  viewportClassName?: string;
} & Pick<React.ComponentProps<"div">, "role">;

/**
 * A scroll container whose scrollbars are overlays drawn over the content, so
 * they take no width. A classic Windows scrollbar either reserves its lane
 * (`scrollbar-gutter: stable` - an empty strip beside the content whenever
 * nothing scrolls) or narrows the content the moment it starts to overflow
 * (columns and grid cards jump). An overlay does neither, on every platform.
 *
 * Scrolling itself stays native - wheel, keyboard and touch all go to the
 * viewport; Radix only hides the system bar and draws its own, coloured by the
 * same `--scrollbar-thumb*` tokens `globals.css` gives every native scrollbar.
 * Tables use it through `TableScroll`.
 */
export function ScrollArea({
  children,
  ref,
  layout = "block",
  locked,
  className,
  viewportClassName,
  role,
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      type="hover"
      data-slot="scroll-area"
      className={cn(
        "relative overflow-hidden",
        locked && "opacity-50 pointer-events-none transition-opacity duration-150",
        className,
      )}
    >
      <ScrollAreaPrimitive.Viewport
        ref={ref}
        role={role}
        className={cn(
          "size-full rounded-[inherit]",
          // Radix wraps the content in a `display: table` div, which sizes to
          // its widest child and would defeat every `truncate` inside. As a
          // block it is exactly the viewport's width, and wider rows
          // (`min-w-fit`) still scroll sideways.
          layout === "block" && "[&>div]:block!",
          layout === "column" && "[&>div]:flex! [&>div]:min-h-full [&>div]:flex-col",
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaBar orientation="vertical" />
      <ScrollAreaBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

/**
 * The overlay bar - the same geometry as the native scrollbar in globals.css:
 * a 10px track with 2px of padding around a 6px thumb, which grows to 8px
 * while the pointer is on the thumb or dragging it (a negative margin eats 1px
 * of the padding on each side, so the track never changes size). Fades in on
 * hover or scroll.
 *
 * `data-slot` lets globals.css hide it on overlay platforms (macOS, iOS,
 * Android), where the viewport hands scrolling back to the system's own
 * overlay scrollbar so it matches every other scroller on that device.
 */
function ScrollAreaBar({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      data-slot="scroll-area-bar"
      className={cn(
        "z-20 flex touch-none select-none p-0.5",
        "data-[state=visible]:animate-in data-[state=visible]:fade-in-0",
        "data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0",
        orientation === "vertical" && "h-full w-2.5",
        orientation === "horizontal" && "h-2.5 flex-col",
      )}
    >
      <ScrollAreaPrimitive.Thumb
        className={cn(
          "relative flex-1 rounded-full bg-(--scrollbar-thumb)",
          "hover:bg-(--scrollbar-thumb-hover) active:bg-(--scrollbar-thumb-active)",
          orientation === "vertical" && "hover:-mx-px active:-mx-px",
          orientation === "horizontal" && "hover:-my-px active:-my-px",
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

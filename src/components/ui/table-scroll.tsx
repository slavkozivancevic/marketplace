import * as React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type TableScrollProps = {
  children: React.ReactNode;
  /** The element that actually scrolls - what a virtualizer's `getScrollElement` must return. */
  ref?: React.Ref<HTMLDivElement>;
  /** Fades the table and blocks clicks while a row action or a refetch is in flight. */
  locked?: boolean;
  /**
   * `fill` (default) takes the remaining height of a flex column - a page's
   * main table. `capped` grows with its rows up to 24rem and scrolls past
   * that - a preview table inside a form or panel. `auto` is always as tall as
   * its rows and only ever scrolls sideways - a short table in the page flow.
   */
  height?: "fill" | "capped" | "auto";
  /** `false` when the table sits inside a panel that already draws the border. */
  bordered?: boolean;
  /**
   * The children are a real `<table>`, which carries its own semantics - the
   * viewport then gets no `role`, so assistive tech does not see a table
   * nested in a table. Grid-of-divs tables (the default) get `role="table"`.
   */
  nativeTable?: boolean;
  className?: string;
};

/**
 * The scroll container every table renders in - the live table and its
 * skeleton alike. A `ScrollArea` (overlay scrollbars that take no width, so no
 * empty strip inside the border and no column jump when rows start to
 * overflow) with the table's frame and semantics. `table-scroll.test.ts` fails
 * CI on a hand-written `role="table"` container or an unwrapped `<table>`.
 */
export function TableScroll({
  children,
  ref,
  locked,
  height = "fill",
  bordered = true,
  nativeTable = false,
  className,
}: TableScrollProps) {
  return (
    <ScrollArea
      ref={ref}
      role={nativeTable ? undefined : "table"}
      locked={locked}
      className={cn(height === "fill" && "flex-1 min-h-0", bordered && "rounded-lg border", className)}
      // A capped or auto table has no definite height for `h-full` to resolve
      // against, so its limit goes on the viewport - the element that scrolls.
      viewportClassName={cn(height === "capped" && "h-auto max-h-96", height === "auto" && "h-auto")}
    >
      {children}
    </ScrollArea>
  );
}

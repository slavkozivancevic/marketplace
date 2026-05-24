"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTooltipProps {
  /** Single React element that accepts a ref (CardTitle, p, div, etc.). */
  children: React.ReactElement;
  /** Full text shown in the tooltip - usually the same as the child's text content. */
  content: React.ReactNode;
  delayDuration?: number;
  side?: "top" | "right" | "bottom" | "left";
  contentClassName?: string;
}

/**
 * Wraps an ellipsis-truncated element and shows a tooltip with the full text
 * ONLY when the element is actually overflowing. Detects both single-line
 * (scrollWidth > clientWidth) and multi-line clamp (scrollHeight > clientHeight)
 * truncation, and re-measures on resize.
 */
export function TruncatedTooltip({
  children,
  content,
  delayDuration = 400,
  side = "top",
  contentClassName = "max-w-sm whitespace-normal",
}: TruncatedTooltipProps) {
  // Callback ref via useState - avoids the `react-hooks/refs` lint warning
  // that fires when a `useRef` object is forwarded through cloneElement.
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    if (!el) return;
    const measure = () => {
      // +1 absorbs sub-pixel rounding quirks across browsers.
      const truncated =
        el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      setIsTruncated(truncated);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, content]);

  const child = React.cloneElement(
    children as React.ReactElement<{ ref?: React.Ref<HTMLElement> }>,
    { ref: setEl },
  );

  return (
    <Tooltip delayDuration={delayDuration} open={isTruncated ? undefined : false}>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

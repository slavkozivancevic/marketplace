"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSupportsHover } from "@/hooks/useSupportsHover";
import { createLongPress } from "@/lib/longPress";
import { cn } from "@/lib/utils";

interface TruncatedTooltipProps {
  /** Single React element that accepts a ref (CardTitle, p, div, etc.). */
  children: React.ReactElement;
  /** Full text shown in the tooltip - usually the same as the child's text content. */
  content: React.ReactNode;
  delayDuration?: number;
  side?: "top" | "right" | "bottom" | "left";
  contentClassName?: string;
}

type ChildProps = {
  ref?: React.Ref<HTMLElement>;
  className?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLElement>) => void;
  onClickCapture?: (e: React.MouseEvent<HTMLElement>) => void;
};

/**
 * Wraps an ellipsis-truncated element and shows a tooltip with the full text
 * ONLY when the element is actually overflowing. Detects both single-line
 * (scrollWidth > clientWidth) and multi-line clamp (scrollHeight > clientHeight)
 * truncation, and re-measures on resize.
 *
 * - Desktop: on hover, after `delayDuration`.
 * - Touch: a long press (the same press `IconButton` uses for its label) shows
 *   it, and the click that ends the press is swallowed, so a cell inside a row
 *   link does not also open the row. A short tap does what it always did. It
 *   stays up until the next touch elsewhere or a scroll - a long text needs
 *   longer to read than an icon's one-word label.
 *
 * The child's own pointer and click handlers still run; nothing is replaced.
 */
export function TruncatedTooltip({
  children,
  content,
  delayDuration = 400,
  side = "top",
  contentClassName = "max-w-sm whitespace-normal",
}: TruncatedTooltipProps) {
  const canHover = useSupportsHover();
  // Callback ref via useState - avoids the `react-hooks/refs` lint warning
  // that fires when a `useRef` object is forwarded through cloneElement.
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const [open, setOpen] = React.useState(false);

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

  // One press tracker for the element's whole life. No auto-hide: the text
  // stays until the reader taps elsewhere or scrolls. Opening is gated on
  // `isTruncated` below, so a press on text that fits shows nothing.
  const [press] = React.useState(() => createLongPress({ show: () => setOpen(true) }));
  React.useEffect(() => () => press.dispose(), [press]);

  // A touch-opened tooltip has no pointer leaving it to close it; a scroll
  // moves the text away from under it, so that closes it too.
  React.useEffect(() => {
    if (!open || canHover) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open, canHover]);

  const onOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    // On touch only the long press opens it.
    if (canHover) setOpen(true);
  };

  const own = (children as React.ReactElement<ChildProps>).props;
  const child = React.cloneElement(children as React.ReactElement<ChildProps>, {
    ref: setEl,
    // No native callout or text selection fighting the held finger.
    className: cn(own.className, "[-webkit-touch-callout:none] pointer-coarse:select-none"),
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      press.down(e.pointerType, e.clientX, e.clientY);
      own.onPointerDown?.(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      press.move(e.clientX, e.clientY);
      own.onPointerMove?.(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      press.end();
      own.onPointerUp?.(e);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      press.end();
      own.onPointerCancel?.(e);
    },
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
      // The click that ends a long press only revealed the text.
      if (press.consumeClick()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      own.onClickCapture?.(e);
    },
  });

  // Always pass a boolean `open` so Radix sees a stable controlled component.
  // Toggling between `undefined` (uncontrolled) and `false` (controlled)
  // triggers React's "changing from controlled to uncontrolled" warning.
  return (
    <Tooltip
      delayDuration={delayDuration}
      open={isTruncated && open}
      onOpenChange={onOpenChange}
    >
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSupportsHover } from "@/hooks/useSupportsHover";
import { createLongPress } from "@/lib/longPress";
import { cn } from "@/lib/utils";

/** Same delay as `TruncatedTooltip`: long enough not to flicker while the mouse passes over a row of icons. */
const TOOLTIP_DELAY_MS = 400;

export type IconButtonProps = Omit<ButtonProps, "title" | "aria-label"> & {
  /**
   * What the button does ("Edit", "Delete"). One string serves as its
   * accessible name AND its tooltip, so the two can never say different things.
   */
  label: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
};

/**
 * The project's only icon-only button (CLAUDE.md, "Icon-only buttons").
 *
 * Before it there were three behaviours side by side - a native `title`
 * bubble, a styled tooltip, or nothing - so in one table row the duplicate icon
 * explained itself on hover and the edit and delete icons beside it did not,
 * and six header and editor buttons had no name at all.
 *
 * - Desktop: the tooltip opens on hover, and on keyboard focus. Not on focus
 *   that a closing dialog hands BACK to its trigger - that is not
 *   `:focus-visible`, and the delete icon popping "Delete" up right after the
 *   dialog closes reads as a glitch.
 * - Touch: a short tap runs the action, as always. A long press shows the same
 *   tooltip and does NOT run it - the touch counterpart of hover, so at rest a
 *   phone looks exactly like a desktop.
 * - Disabled: no tooltip; a disabled icon here is a running action whose
 *   spinner already says what is happening.
 *
 * Every Button prop and the ref pass straight through, and the caller's own
 * handlers are chained, never replaced - so it works as the child of
 * `ActionButton`, of `DropdownMenuTrigger` / `PopoverTrigger asChild`, and with
 * `asChild` itself.
 */
export function IconButton({
  label,
  tooltipSide = "top",
  size = "icon",
  variant = "ghost",
  disabled,
  className,
  onClick,
  onFocus,
  onBlur,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
  ...props
}: IconButtonProps) {
  const canHover = useSupportsHover();
  const [open, setOpen] = React.useState(false);
  const hovered = React.useRef(false);
  const focusVisible = React.useRef(false);

  // One press tracker per button for its whole life; it owns both its timers
  // (the hold, and the auto-close of the label it reveals).
  const [press] = React.useState(() =>
    createLongPress({ show: () => setOpen(true), hide: () => setOpen(false) }),
  );
  React.useEffect(() => () => press.dispose(), [press]);

  const onOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    // On touch only the long press opens it: Radix would also open on the
    // focus a plain tap gives the button.
    if (!canHover) return;
    if (hovered.current || focusVisible.current) setOpen(true);
  };

  return (
    // Always a boolean `open`: switching between controlled and uncontrolled
    // makes React warn (the same reason TruncatedTooltip keeps it controlled).
    <Tooltip delayDuration={TOOLTIP_DELAY_MS} open={open && !disabled} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={disabled}
          aria-label={label}
          // No native callout or text selection while a finger is held down.
          className={cn("select-none [-webkit-touch-callout:none]", className)}
          {...props}
          onClick={(e) => {
            // The click that ends a long press only revealed the label.
            if (press.consumeClick()) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            onClick?.(e);
          }}
          onFocus={(e) => {
            // Read before Radix's own focus handler asks `onOpenChange`.
            focusVisible.current = e.currentTarget.matches(":focus-visible");
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focusVisible.current = false;
            onBlur?.(e);
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") hovered.current = true;
            onPointerEnter?.(e);
          }}
          onPointerLeave={(e) => {
            hovered.current = false;
            onPointerLeave?.(e);
          }}
          onPointerDown={(e) => {
            press.down(e.pointerType, e.clientX, e.clientY);
            onPointerDown?.(e);
          }}
          onPointerMove={(e) => {
            press.move(e.clientX, e.clientY);
            onPointerMove?.(e);
          }}
          onPointerUp={(e) => {
            press.end();
            onPointerUp?.(e);
          }}
          onPointerCancel={(e) => {
            press.end();
            onPointerCancel?.(e);
          }}
          onContextMenu={(e) => {
            // Android opens its own menu on a long press; the label is ours.
            if (!canHover) e.preventDefault();
            onContextMenu?.(e);
          }}
        />
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

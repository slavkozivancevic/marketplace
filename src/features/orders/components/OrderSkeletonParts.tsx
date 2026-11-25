"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Skeleton, SkeletonCopy } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Placeholders shared by the two order detail skeletons. Each keeps the real
 * element's box - a badge's height and padding, a button's size and icon gap,
 * a card title's line - and draws its label transparent, so a placeholder is as
 * wide as the copy it stands for in every locale.
 */

/** A badge's exact box (height, padding, label width) as a placeholder. */
export function BadgeSlot({ label, icon = false, className }: { label: string; icon?: boolean; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("animate-pulse border-transparent bg-muted text-transparent", className)}>
      {icon && <span className="size-3 shrink-0" />}
      {label}
    </Badge>
  );
}

/** A button's exact box. `iconClass` mirrors how the real one sizes and spaces its icon. */
export function ButtonSlot({
  label,
  size = "sm",
  iconClass,
  className,
}: {
  label: string;
  size?: "sm" | "default";
  iconClass?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        buttonVariants({ variant: "outline", size }),
        "pointer-events-none animate-pulse border-transparent bg-muted text-transparent",
        className,
      )}
    >
      {iconClass && <span className={cn("shrink-0", iconClass)} />}
      {label}
    </div>
  );
}

/** A label / value row of known copy. */
export function CopyRow({
  label,
  value,
  className,
  numeric = true,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  /** The real value cell is `tabular-nums` (seller page) or plain (buyer page). */
  numeric?: boolean;
}) {
  return (
    <div className={cn("flex justify-between", className)}>
      <span>
        <SkeletonCopy>{label}</SkeletonCopy>
      </span>
      <span className={numeric ? "tabular-nums" : undefined}>
        <SkeletonCopy>{value}</SkeletonCopy>
      </span>
    </div>
  );
}

/** The small print under a breakdown. */
export function CopyNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[11px] text-muted-foreground/80">
      <SkeletonCopy>{children}</SkeletonCopy>
    </p>
  );
}

/**
 * A card title of known copy, optionally led by its 16px icon. `plain` for a
 * real title with no `text-base` of its own: adding the class is not a no-op -
 * tailwind-merge then drops CardTitle's `leading-snug`, and the line grows from
 * 22px to 24px.
 */
export function CardTitleCopy({
  children,
  icon = false,
  plain = false,
}: {
  children: ReactNode;
  icon?: boolean;
  plain?: boolean;
}) {
  return (
    <CardTitle className={cn(!plain && "text-base", icon && "flex items-center gap-2")}>
      {icon && <Skeleton className="h-4 w-4 shrink-0 rounded" />}
      <SkeletonCopy>{children}</SkeletonCopy>
    </CardTitle>
  );
}

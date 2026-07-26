"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 pt-3 pb-3 mb-2 sm:pt-6 sm:pb-4 sticky-header-bg will-change-transform",
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5 min-w-0">
          <TruncatedTooltip content={title}>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
          </TruncatedTooltip>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">{description}</p>
          )}
        </div>

        {children && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">{children}</div>
        )}
      </div>
    </div>
  );
}

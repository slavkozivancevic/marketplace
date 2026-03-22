"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export function LoadingSpinner({
  size = 24,
  className,
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-4 border-t-primary border-gray-200",
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    />
  );
}

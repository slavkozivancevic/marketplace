"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
}

function StarIcon({
  fraction,
  size,
  interactive,
  outlineHighlighted,
  onMouseEnter,
  onClick,
}: {
  fraction: number;
  size: number;
  interactive?: boolean;
  /** True when this star is empty but within the cumulative hover range */
  outlineHighlighted?: boolean;
  onMouseEnter?: () => void;
  onClick?: () => void;
}) {
  if (fraction >= 1) {
    return (
      <Star
        size={size}
        className={cn(
          "fill-yellow-400 text-yellow-400 transition-colors duration-100",
          interactive && "cursor-pointer",
        )}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      />
    );
  }

  if (fraction <= 0) {
    return (
      <Star
        size={size}
        className={cn(
          "fill-none transition-colors duration-100",
          interactive && "cursor-pointer hover:text-yellow-400",
          outlineHighlighted ? "text-yellow-400" : "text-muted-foreground/40",
        )}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      />
    );
  }

  // Partial fill for fractional ratings (display-only)
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <Star size={size} className="fill-none text-muted-foreground/40 transition-colors duration-100" />
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${fraction * 100}%` }}
      >
        <Star size={size} className="fill-yellow-400 text-yellow-400" />
      </span>
    </span>
  );
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 16,
  interactive = false,
  onRatingChange,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      onMouseLeave={interactive ? () => setHovered(null) : undefined}
    >
      {Array.from({ length: maxRating }, (_, i) => {
        const fraction = Math.min(Math.max(rating - i, 0), 1);
        const starNum = i + 1;
        const outlineHighlighted =
          interactive && fraction < 1 && hovered !== null && starNum <= hovered;

        return (
          <StarIcon
            key={i}
            fraction={fraction}
            size={size}
            interactive={interactive}
            outlineHighlighted={outlineHighlighted}
            onMouseEnter={interactive ? () => setHovered(starNum) : undefined}
            onClick={interactive ? () => onRatingChange?.(starNum) : undefined}
          />
        );
      })}
    </div>
  );
}
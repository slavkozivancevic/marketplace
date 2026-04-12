"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 16,
  interactive = false,
  onRatingChange,
}: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxRating }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= rating;

        return (
          <Star
            key={i}
            size={size}
            className={cn(
              "transition-colors",
              filled
                ? "fill-yellow-400 text-yellow-400"
                : "fill-none text-muted-foreground/40",
              interactive && "cursor-pointer hover:text-yellow-400",
            )}
            onClick={
              interactive ? () => onRatingChange?.(starValue) : undefined
            }
          />
        );
      })}
    </div>
  );
}

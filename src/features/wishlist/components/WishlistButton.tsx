"use client";

import { Heart } from "lucide-react";
import { useClerk, useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useIsWishlisted, useWishlistToggle } from "../hooks/useWishlist";

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: number;
}

export function WishlistButton({
  productId,
  className,
  size = 18,
}: WishlistButtonProps) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const isWishlisted = useIsWishlisted(productId);
  const { mutate, isPending } = useWishlistToggle();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isSignedIn) {
      openSignIn();
      return;
    }

    mutate(productId);
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 cursor-pointer",
        "bg-background/85 backdrop-blur-xs border border-border/60 shadow-sm",
        "hover:scale-110 hover:border-rose-400/60",
        isWishlisted && "border-rose-400/60",
        className,
      )}
    >
      <Heart
        style={{ width: size, height: size }}
        className={cn(
          "transition-all duration-200",
          isWishlisted
            ? "fill-rose-500 stroke-rose-500"
            : "fill-transparent stroke-muted-foreground",
          "hover:stroke-rose-400",
        )}
      />
    </button>
  );
}
"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useClerk, useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "../store/wishlistStore";
import { toggleWishlist } from "../actions/wishlist";

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
  const isWishlisted = useWishlistStore((s) => s.has(productId));
  const toggle = useWishlistStore((s) => s.toggle);
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const active = optimistic ?? isWishlisted;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isSignedIn) {
      openSignIn();
      return;
    }

    const next = !active;
    setOptimistic(next);
    toggle(productId);

    startTransition(async () => {
      const result = await toggleWishlist(productId);
      if ("error" in result) {
        // Revert on error
        setOptimistic(!next);
        toggle(productId);
      } else {
        setOptimistic(null);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 cursor-pointer",
        "bg-background/85 backdrop-blur-sm border border-border/60 shadow-sm",
        "hover:scale-110 hover:border-rose-400/60",
        active && "border-rose-400/60",
        className,
      )}
    >
      <Heart
        style={{ width: size, height: size }}
        className={cn(
          "transition-all duration-200",
          active
            ? "fill-rose-500 stroke-rose-500"
            : "fill-transparent stroke-muted-foreground",
          "hover:stroke-rose-400",
        )}
      />
    </button>
  );
}
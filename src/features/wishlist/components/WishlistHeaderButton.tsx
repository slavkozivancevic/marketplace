"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useWishlistStore } from "../store/wishlistStore";

export function WishlistHeaderButton() {
  const count = useSyncExternalStore(
    useWishlistStore.subscribe,
    () => useWishlistStore.getState().count(),
    () => 0,
  );

  return (
    <div className="relative">
      <Button variant="outline" size="icon" asChild>
        <Link href="/wishlist" aria-label="Wishlist">
          <Heart className="h-4 w-4" />
        </Link>
      </Button>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white pointer-events-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}
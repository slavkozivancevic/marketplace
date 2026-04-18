"use client";

import { useEffect } from "react";
import { useWishlistStore } from "../store/wishlistStore";

export function WishlistInitializer({ ids }: { ids: string[] }) {
  const hydrate = useWishlistStore((s) => s.hydrate);

  useEffect(() => {
    hydrate(ids);
  }, [ids, hydrate]);

  return null;
}
"use client";

import { useSyncExternalStore } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "../store/cartStore";

export function CartButton() {
  const openCart = useCartStore((s) => s.openCart);

  const count = useSyncExternalStore(
    useCartStore.subscribe,
    () => useCartStore.getState().totalItems(),
    () => 0,
  );

  return (
    <div className="relative">
      <Button variant="outline" size="icon" onClick={openCart}>
        <ShoppingCart className="h-4 w-4" />
      </Button>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}

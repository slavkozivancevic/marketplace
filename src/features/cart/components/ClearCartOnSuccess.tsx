"use client";

import { useEffect } from "react";
import { useCartStore } from "../store/cartStore";

export function ClearCartOnSuccess() {
  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      useCartStore.getState().clearCart();
      return;
    }
    return useCartStore.persist.onFinishHydration(() => {
      useCartStore.getState().clearCart();
    });
  }, []);

  return null;
}

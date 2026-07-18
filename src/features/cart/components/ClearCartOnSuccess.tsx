"use client";

import { useEffect } from "react";
import { useCartStore } from "../store/cartStore";
import { clearStoredCoupon } from "../utils/couponStorage";

export function ClearCartOnSuccess() {
  useEffect(() => {
    // The order is done - drop the persisted coupon along with the cart so a
    // redeemed code never auto-applies to the buyer's next checkout.
    clearStoredCoupon();
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

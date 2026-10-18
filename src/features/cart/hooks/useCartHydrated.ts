"use client";

import { useSyncExternalStore } from "react";
import { useCartStore } from "../store/cartStore";

/**
 * Whether the persisted cart has been read back from localStorage yet.
 *
 * Tells "store not loaded yet" apart from "cart genuinely empty". The server
 * has no localStorage, and zustand renders its initial (empty) state during
 * hydration too, so a page that branches on `items.length === 0` right away
 * shows "Your cart is empty" for a moment to a buyer who has three things in
 * it - on a direct load of /cart, or a Back from Stripe into checkout.
 *
 * An external store rather than state set in an effect: React uses the server
 * snapshot (`false`) for the hydration render, so server and client agree by
 * construction, and switches to the live answer right after. The persist API
 * is only touched on the client - reading it during a server render crashes.
 */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useCartStore.persist.onFinishHydration(onChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

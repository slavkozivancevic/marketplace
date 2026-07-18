// Persists the applied coupon code (not the discount - that's re-derived)
// across a full page reload, so it survives the Stripe redirect + browser Back
// round trip where React state is lost but the cart (localStorage) is restored.
// Cleared together with the cart once an order completes - a redeemed coupon
// must never auto-apply to the next checkout.
export const COUPON_STORAGE_KEY = "checkout:coupon";

export function clearStoredCoupon(): void {
  try {
    sessionStorage.removeItem(COUPON_STORAGE_KEY);
  } catch {
    // Storage unavailable (SSR / privacy mode) - nothing to clear.
  }
}

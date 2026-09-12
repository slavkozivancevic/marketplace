import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartVariantOption, LocalizedText } from "../utils/variantOptions";
import type { CartLinePrice } from "../db/resolveCart";
import { authorMoney, type MoneySet } from "@/lib/money";
import { VALID_CURRENCIES } from "@/lib/currency-config";

export interface CartItem {
  productId: string;
  // Title pre-translated for every locale so the cart can follow a locale
  // switch. `productTitle` stays as the plain fallback (legacy / image alt).
  productTitleI18n: LocalizedText | null;
  productTitle: string;
  productImage: string | null;
  variantId: string | null;
  variantSku: string | null;
  // Selected options, pre-translated for every locale, so the drawer/checkout
  // can render the label in the active language. Null for variant-less or
  // manual (SKU-only) variants - those fall back to `variantLabel`.
  variantOptions: CartVariantOption[] | null;
  // Non-translatable fallback label (variant SKU, or a legacy pre-i18n label).
  variantLabel: string | null;
  // USD-cent mirror, kept because the server still recomputes the cart in USD
  // (coupon minimums, shipping thresholds).
  price: number;
  // The exact per-currency amount, snapshotted when the item was added, so the
  // drawer shows the same number the product page did. Always present: a cart
  // saved before money sets existed gets one rebuilt from its mirror by the v4
  // persist migration, so no render path has to convert `price` any more.
  priceMoney: MoneySet;
  quantity: number;
  maxStock: number | null; // null = unlimited
  requiresShipping: boolean;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  clearCart: () => void;
  /** Replaces the persisted price snapshots with the server-resolved ones. */
  syncPrices: (prices: CartLinePrice[]) => void;
  totalItems: () => number;
  // Deliberately no `totalPrice`: summing the USD mirrors and converting the
  // result once rounds differently from the per-line amounts shown next to it,
  // which is how a cart total ends up a dinar off from its own lines. Callers
  // sum `moneyIn(item.priceMoney, currency)` per line instead.
}

function isSameItem(a: CartItem, productId: string, variantId: string | null) {
  return a.productId === productId && a.variantId === variantId;
}

/** True when two snapshots would render identically in every currency. Compared
 *  field by field rather than by serialising: the two sets come from different
 *  round trips, so key order is not something to rely on, and a false mismatch
 *  would rewrite localStorage on every sync. */
function sameMoneySnapshot(a: MoneySet, b: MoneySet): boolean {
  if (a === b) return true;
  if (a.primary !== b.primary) return false;
  return VALID_CURRENCIES.every((c) => a.amounts[c] === b.amounts[c]);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (newItem, quantity = 1) => {
        const qty = Math.max(1, Math.floor(quantity));
        set((state) => {
          const existing = state.items.find((i) =>
            isSameItem(i, newItem.productId, newItem.variantId),
          );
          if (existing) {
            return {
              items: state.items.map((i) => {
                if (!isSameItem(i, newItem.productId, newItem.variantId)) return i;
                const next = i.quantity + qty;
                return {
                  ...i,
                  quantity: i.maxStock !== null ? Math.min(next, i.maxStock) : next,
                };
              }),
            };
          }
          const capped =
            newItem.maxStock !== null ? Math.min(qty, newItem.maxStock) : qty;
          return { items: [...state.items, { ...newItem, quantity: capped }] };
        });
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !isSameItem(i, productId, variantId),
          ),
        }));
      },

      updateQuantity: (productId, variantId, quantity) => {
        if (quantity < 1) {
          get().removeItem(productId, variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => {
            if (!isSameItem(i, productId, variantId)) return i;
            const capped =
              i.maxStock !== null ? Math.min(quantity, i.maxStock) : quantity;
            return { ...i, quantity: capped };
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      // The price a line was added at is a snapshot, and the seller can edit the
      // product at any time after it was taken. Everything that decides money
      // server-side (shipping thresholds, coupon minimums, the charge itself)
      // re-reads the DB, so a snapshot left alone is how the cart ends up
      // showing one total while checkout charges another. Callers hand back what
      // `resolveCart` returned and the snapshot is replaced with it.
      //
      // Lines the server did not resolve are left untouched - they are the
      // `unavailable` ones, and dropping them is the caller's job (with a
      // message), never a silent side effect of a price refresh.
      syncPrices: (prices) => {
        set((state) => {
          let changed = false;
          const items = state.items.map((i) => {
            const p = prices.find((x) => isSameItem(i, x.productId, x.variantId));
            if (!p) return i;
            if (p.unitPriceUsd === i.price && sameMoneySnapshot(p.unitMoney, i.priceMoney)) {
              return i;
            }
            changed = true;
            return { ...i, price: p.unitPriceUsd, priceMoney: p.unitMoney };
          });
          // Same objects when nothing moved: a new array would rewrite
          // localStorage and re-render every cart consumer for no reason.
          return changed ? { items } : state;
        });
      },

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "cart-storage",
      version: 4,
      partialize: (state) => ({ items: state.items }),
      // Older carts predate the localized snapshots (`variantOptions` in v1,
      // `productTitleI18n` in v2) and the per-currency price set (v3, made
      // mandatory in v4). The first two default to null, which the render path
      // handles by falling back to the plain `variantLabel` / `productTitle`.
      // The price set cannot: it is now required, so v4 rebuilds a USD-only one
      // from the mirror. That is exactly what the old read-time fallback did -
      // done once, here, where a browser's saved cart can actually be migrated,
      // rather than on every render of every price for the life of the app.
      migrate: (persisted, version) => {
        const state = persisted as { items?: CartItem[] } | undefined;
        if (version < 2 && state?.items) {
          state.items = state.items.map((i) => ({
            ...i,
            variantOptions: i.variantOptions ?? null,
            productTitleI18n: i.productTitleI18n ?? null,
          }));
        }
        if (version < 4 && state?.items) {
          state.items = state.items.map((i) => ({
            ...i,
            priceMoney: i.priceMoney ?? authorMoney(i.price, "usd", { usd: 1 }),
          }));
        }
        return state as { items: CartItem[] };
      },
    },
  ),
);

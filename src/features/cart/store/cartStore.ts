import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  productTitle: string;
  productImage: string | null;
  variantId: string | null;
  variantSku: string | null;
  variantLabel: string | null; // e.g. "Red / XL"
  price: number;
  quantity: number;
  maxStock: number | null; // null = unlimited
  requiresShipping: boolean;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

function isSameItem(a: CartItem, productId: string, variantId: string | null) {
  return a.productId === productId && a.variantId === variantId;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find((i) =>
            isSameItem(i, newItem.productId, newItem.variantId),
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                isSameItem(i, newItem.productId, newItem.variantId)
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...newItem, quantity: 1 }] };
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

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "cart-storage",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

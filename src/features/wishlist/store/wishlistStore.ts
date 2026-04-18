import { create } from "zustand";

interface WishlistStore {
  productIds: Set<string>;
  hydrated: boolean;
  hydrate: (ids: string[]) => void;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  toggle: (productId: string) => boolean;
  has: (productId: string) => boolean;
  count: () => number;
}

export const useWishlistStore = create<WishlistStore>()((set, get) => ({
  productIds: new Set(),
  hydrated: false,

  hydrate: (ids) => set({ productIds: new Set(ids), hydrated: true }),

  add: (productId) =>
    set((state) => ({ productIds: new Set([...state.productIds, productId]) })),

  remove: (productId) =>
    set((state) => {
      const next = new Set(state.productIds);
      next.delete(productId);
      return { productIds: next };
    }),

  toggle: (productId) => {
    const store = get();
    if (store.has(productId)) {
      store.remove(productId);
      return false;
    }
    store.add(productId);
    return true;
  },

  has: (productId) => get().productIds.has(productId),

  count: () => get().productIds.size,
}));
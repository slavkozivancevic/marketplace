"use client";

import { create } from "zustand";

/**
 * Tracks whether an inline (non-sticky) `<FormSaveBar>` footer is mounted on
 * the current page. On mobile the admin/dashboard sidebar's nav trigger is a
 * `fixed bottom-4 left-4` button (see `sidebar-nav.tsx`); edit forms
 * (ProductForm, BrandForm, ...) render their save bar as a full-width
 * `shrink-0` footer at the bottom of that same viewport, since the sidebar
 * itself is hidden on mobile - the two would otherwise sit on top of each
 * other. Counted (not boolean) because nothing prevents more than one
 * instance mounting/unmounting across a fast remount.
 */
export const useMobileBottomBarStore = create<{
  count: number;
  register: () => () => void;
}>((set) => ({
  count: 0,
  register: () => {
    set((s) => ({ count: s.count + 1 }));
    return () => set((s) => ({ count: Math.max(0, s.count - 1) }));
  },
}));

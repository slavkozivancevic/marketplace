"use client";

import { create } from "zustand";

/**
 * Tracks whether a full-width footer is mounted at the bottom of the mobile
 * viewport - an inline (non-sticky) `<FormSaveBar>`, or the chat composer on
 * the messages page. The floating side-panel button is a `fixed left-4`
 * circle near the bottom (see `floating-sidebar-trigger.tsx`); edit forms
 * (ProductForm, BrandForm, ...) render their save bar as a full-width
 * `shrink-0` footer at the bottom of that same viewport, since the sidebar
 * itself is hidden on mobile - the two would otherwise sit on top of each
 * other. Counted (not boolean) because nothing prevents more than one
 * instance mounting/unmounting across a fast remount.
 *
 * `extent` is the bar's measured height in px, for a bar that grows: the chat
 * composer gains a panel of staged files above it, which the button's fixed
 * lift no longer cleared. 0 = not measured, the fixed lift applies.
 */
export const useMobileBottomBarStore = create<{
  count: number;
  extent: number;
  register: () => () => void;
  setExtent: (px: number) => void;
}>((set) => ({
  count: 0,
  extent: 0,
  register: () => {
    set((s) => ({ count: s.count + 1 }));
    return () => set((s) => ({ count: Math.max(0, s.count - 1) }));
  },
  setExtent: (px) => set({ extent: Math.max(0, Math.round(px)) }),
}));

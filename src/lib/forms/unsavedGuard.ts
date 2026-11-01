"use client";

import { create } from "zustand";
import { emitNavigationStart } from "@/lib/navigation/navigationProgressSignal";

/**
 * Global "unsaved changes" guard. Forms register their dirty state here (via
 * `useUnsavedChangesWarning`); the `<UnsavedChangesGuard>` component and the
 * language switcher consult it before letting an in-app navigation proceed, so
 * the user gets a single, consistent confirmation dialog instead of the
 * browser's native refresh alert.
 */
interface UnsavedGuardStore {
  /** Ids of forms currently holding unsaved changes. */
  dirtyForms: Set<string>;
  /** Pending navigation, queued while the confirm dialog is open. */
  pending: (() => void) | null;
  /** Where the pending navigation goes, when it is a page in this app. */
  pendingTarget: string | null;
  markDirty: (id: string, dirty: boolean) => void;
  hasUnsaved: () => boolean;
  /**
   * Gate an in-app navigation. Returns true (and does nothing) when there are
   * no unsaved changes - the caller should navigate. When there ARE unsaved
   * changes it stores `proceed` and returns false; the dialog then resolves it.
   */
  guard: (proceed: () => void, target?: string) => boolean;
  /** User chose to leave: drop dirty state and run the pending navigation. */
  confirmLeave: () => void;
  /** User chose to stay: discard the pending navigation. */
  stay: () => void;
}

export const useUnsavedGuardStore = create<UnsavedGuardStore>((set, get) => ({
  dirtyForms: new Set(),
  pending: null,
  pendingTarget: null,
  markDirty: (id, dirty) =>
    set((state) => {
      const next = new Set(state.dirtyForms);
      if (dirty) next.add(id);
      else next.delete(id);
      return { dirtyForms: next };
    }),
  hasUnsaved: () => get().dirtyForms.size > 0,
  guard: (proceed, target) => {
    if (get().dirtyForms.size === 0) return true;
    set({ pending: proceed, pendingTarget: target ?? null });
    return false;
  },
  confirmLeave: () => {
    const { pending, pendingTarget } = get();
    // Clear dirty state first so the queued navigation isn't re-blocked.
    set({ dirtyForms: new Set(), pending: null, pendingTarget: null });
    // The original click was suppressed while the dialog was up, so
    // NavigationProgress never started - kick it off now that the
    // navigation is actually about to run.
    emitNavigationStart(pendingTarget ?? undefined);
    pending?.();
  },
  stay: () => set({ pending: null, pendingTarget: null }),
}));

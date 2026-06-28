"use client";

import { useEffect, useId } from "react";
import { useUnsavedGuardStore } from "./unsavedGuard";

/**
 * Registers a form's dirty state with the global unsaved-changes guard.
 *
 * While `isDirty` is true the form is tracked; the `<UnsavedChangesGuard>`
 * component intercepts in-app navigation (sidebar/nav links, the language
 * switcher) and shows a single confirmation dialog instead of silently losing
 * the edits. We deliberately do NOT use the browser's native `beforeunload`
 * prompt - it can't be styled and the product doesn't want that alert.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  const id = useId();
  const markDirty = useUnsavedGuardStore((s) => s.markDirty);

  useEffect(() => {
    markDirty(id, isDirty);
    return () => markDirty(id, false);
  }, [id, isDirty, markDirty]);
}

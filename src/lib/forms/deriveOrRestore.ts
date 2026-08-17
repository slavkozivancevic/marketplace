/**
 * Computes the next value for a field kept auto-derived from another (slug
 * from name/title, key from label, ...) until the user manually edits it.
 *
 * Blindly re-deriving on every source change breaks once the source value
 * returns to its saved baseline: the saved derived value isn't necessarily
 * what deriving from the saved source would produce (a manually-set slug, a
 * leftover value from before a rename, ...). Re-deriving there swaps in a
 * DIFFERENT value than what's actually saved, so the derived field never
 * matches its baseline again - stuck permanently "changed" (a lingering
 * changed-hint / unsaved-changes warning that a full page reload only masks
 * until the next edit). When the source is back to its saved value, this
 * restores the derived field to ITS saved value instead of re-deriving.
 */
export function deriveOrRestore(
  currentSource: string | null | undefined,
  savedSource: string | null | undefined,
  savedDerived: string | null | undefined,
  derive: (source: string) => string,
): string {
  if ((currentSource ?? "") === (savedSource ?? "")) {
    return savedDerived ?? "";
  }
  return derive(currentSource ?? "");
}

/**
 * How a product gallery differs from its saved version, for the Media
 * section's changed markers. Order matters - item 1 is the cover the carousel
 * and the cart thumbnail use - so a pure reorder counts as a change.
 */
export type GalleryChange = {
  changed: boolean;
  /** The items in both lists are not in the saved order. */
  reordered: boolean;
  added: number;
  removed: number;
};

export function galleryChange(savedKeys: string[], currentKeys: string[]): GalleryChange {
  const kept = currentKeys.filter((k) => savedKeys.includes(k));
  const keptInSavedOrder = savedKeys.filter((k) => currentKeys.includes(k));
  return {
    changed: savedKeys.join("\n") !== currentKeys.join("\n"),
    reordered: kept.join("\n") !== keptInSavedOrder.join("\n"),
    added: currentKeys.length - kept.length,
    removed: savedKeys.length - keptInSavedOrder.length,
  };
}

/**
 * The marker one tile gets: "new" when it is not saved, its saved position
 * (1-based) when it sits somewhere else now, nothing when it has not moved.
 */
export function tileChange(
  savedKeys: string[],
  key: string,
  index: number,
): { kind: "new" } | { kind: "moved"; from: number } | null {
  const savedIndex = savedKeys.indexOf(key);
  if (savedIndex === -1) return { kind: "new" };
  return savedIndex !== index ? { kind: "moved", from: savedIndex + 1 } : null;
}

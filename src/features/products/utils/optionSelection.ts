/**
 * The variant-axis pill selection ("generate from options") and its ordering.
 *
 * Kept out of `ProductForm.tsx` so it stays importable on its own - reaching it
 * through the component pulls in the S3/env module chain, which makes it
 * untestable without a full server environment.
 */

export type OptionSelection = { attributeId: string; optionIds: string[] }[];

/** Just enough of an attribute to know the admin-defined ordering. */
export type OptionOrderSource = { id: string; options: readonly { id: string }[] };

/**
 * Derives the selection from saved variants, exactly the way the editor seeds
 * it, so the form opens with the pills pre-checked AND with a baseline the
 * dirty check can compare against.
 */
export function buildOptionSelection(
  variants: readonly {
    attributeValues: readonly { attributeId: string; optionId: string }[];
  }[],
  attributeLibrary: readonly OptionOrderSource[],
): OptionSelection {
  const byAttr = new Map<string, Set<string>>();
  for (const v of variants) {
    for (const av of v.attributeValues) {
      let set = byAttr.get(av.attributeId);
      if (!set) byAttr.set(av.attributeId, (set = new Set()));
      set.add(av.optionId);
    }
  }
  return orderSelection(
    [...byAttr.entries()].map(([attributeId, ids]) => [attributeId, [...ids]]),
    attributeLibrary,
  );
}

/** Normalizes an editor selection back into the ordered form-field shape. */
export function normalizeOptionSelection(
  picked: Record<string, string[]>,
  attributeLibrary: readonly OptionOrderSource[],
): OptionSelection {
  return orderSelection(
    Object.entries(picked).filter(([, optionIds]) => optionIds.length > 0),
    attributeLibrary,
  );
}

/**
 * Orders axes and their option ids the way the admin arranged them (the
 * attribute's own `order`, which the library query already sorts by).
 *
 * Sorting by id instead - as this first did, purely to get a stable shape to
 * diff against - scrambled the selection into UUID order. That leaked well past
 * the pills: `generate()` walks these arrays to build the cartesian product, so
 * the generated variants, the storefront's variant picker and the add-to-cart
 * dropdown all inherited the scrambled order (M/L coming back as L/M).
 *
 * Ordering still has to be deterministic, since the selection is diffed against
 * its saved baseline: anything missing from the library sorts last, by id,
 * rather than being left in Map insertion order.
 */
function orderSelection(
  entries: [string, string[]][],
  attributeLibrary: readonly OptionOrderSource[],
): OptionSelection {
  const attrRank = new Map(attributeLibrary.map((a, i) => [a.id, i]));
  const optionRank = new Map<string, number>();
  for (const attr of attributeLibrary) {
    attr.options.forEach((o, i) => optionRank.set(`${attr.id}:${o.id}`, i));
  }
  const rank = (map: Map<string, number>, key: string) =>
    map.get(key) ?? Number.MAX_SAFE_INTEGER;

  return entries
    .map(([attributeId, optionIds]) => ({
      attributeId,
      optionIds: [...optionIds].sort((x, y) => {
        const d =
          rank(optionRank, `${attributeId}:${x}`) -
          rank(optionRank, `${attributeId}:${y}`);
        return d !== 0 ? d : x.localeCompare(y);
      }),
    }))
    .sort((a, b) => {
      const d = rank(attrRank, a.attributeId) - rank(attrRank, b.attributeId);
      return d !== 0 ? d : a.attributeId.localeCompare(b.attributeId);
    });
}

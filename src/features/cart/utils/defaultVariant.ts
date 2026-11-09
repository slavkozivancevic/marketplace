/**
 * The variant a product page or quick view opens on: the first one in stock, in
 * the order the buyer reads the pills - the first value of the first axis, then
 * of the next, as `product.options` lists them.
 *
 * Not the order of `product.variants`. That is the row order of the seller's
 * variant editor (`ProductVariant.order`), which records when a row was added,
 * not which one comes first: a color added later, or rows written by a script,
 * put "S / Blue" ahead of "S / Black" and the page opened on the fourth color,
 * with the gallery jumped to that color's photo ("3 of 3") instead of the first.
 */

type Option = { id: string; values: { value: string }[] };
type Variant = { stock: number; optionValues: { optionId: string; value: string }[] };

export function firstInStockVariant<V extends Variant>(
  options: Option[],
  variants: V[],
): V | undefined {
  // Each variant's position on every axis, in pill order. A value the axis does
  // not list sorts last rather than first.
  const rank = (variant: V) =>
    options.map((option) => {
      const value = variant.optionValues.find((ov) => ov.optionId === option.id)?.value;
      const index = option.values.findIndex((v) => v.value === value);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    });
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  };
  return variants
    .filter((v) => v.stock > 0)
    .map((v) => ({ v, r: rank(v) }))
    .sort((a, b) => compare(a.r, b.r))[0]?.v;
}

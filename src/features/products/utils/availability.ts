/**
 * What a card may say about having something in stock.
 *
 * Stock lives in two places. A simple product carries it on `Product.stock`,
 * while a product with variants carries it per variant and leaves that column
 * NULL - the same two-source shape the admin stock filter already deals with
 * (`features/products/db/products.ts`). A card that read only the column was
 * therefore silent about every variant product, including ones whose last
 * variant had sold out, and still offered to add them to a cart.
 *
 * `untracked` is a real third answer, not a missing one: a seller who never
 * entered a number has not said the item is sold out, and a card must not
 * invent either claim.
 */
export type CardAvailability = "in_stock" | "out_of_stock" | "untracked";

export function cardAvailability({
  stock,
  variantCount,
  hasVariantInStock,
}: {
  /** `Product.stock` - null when untracked, or when variants own the stock. */
  stock: number | null;
  /** How many variants exist at all, in stock or not. */
  variantCount: number;
  /** Whether at least one variant still has stock. */
  hasVariantInStock: boolean;
}): CardAvailability {
  // Variants win when they exist: the column beside them is null by design,
  // and reading it would report "untracked" for a product that is simply out.
  if (variantCount > 0) return hasVariantInStock ? "in_stock" : "out_of_stock";
  if (stock == null) return "untracked";
  return stock > 0 ? "in_stock" : "out_of_stock";
}

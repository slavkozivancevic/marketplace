import { Prisma } from "@/generated/prisma/client";
import { moneyUsdCents, serializeMoney, type MoneySet } from "@/lib/money";

/**
 * Writes a money value as the pair every money column comes in: the `Json` set
 * (what a buyer is shown and charged, per currency) and the `Int` USD-cent
 * mirror (what sorting, price filters and thresholds compare).
 *
 * The two must always be written together, in the same statement. A mirror that
 * disagrees with its set is the silent failure mode this whole design is built
 * to avoid: prices would sort and filter as one number while displaying as
 * another, and nothing would look broken until a buyer noticed.
 */

/** Mirror + set for one required money field. */
export function moneyCol(set: MoneySet) {
  return { mirror: moneyUsdCents(set), json: serializeMoney(set) };
}

/** Mirror + set for an optional one. `Prisma.DbNull` clears a Json column;
 *  plain `null` would be rejected for a non-nullable Json and, worse, writes
 *  a JSON `null` value rather than SQL NULL where it is accepted. */
export function optionalMoneyCol(set: MoneySet | null | undefined) {
  return {
    mirror: set ? moneyUsdCents(set) : null,
    json: set ? serializeMoney(set) : Prisma.DbNull,
  };
}

/** The three price columns a Product or ProductVariant always carries. */
export function priceColumns(input: {
  price: MoneySet;
  compareAtPrice?: MoneySet | null;
  costPrice?: MoneySet | null;
}) {
  const price = moneyCol(input.price);
  const compareAt = optionalMoneyCol(input.compareAtPrice);
  const cost = optionalMoneyCol(input.costPrice);
  return {
    price: price.mirror,
    priceMoney: price.json,
    compareAtPrice: compareAt.mirror,
    compareAtPriceMoney: compareAt.json,
    costPrice: cost.mirror,
    costPriceMoney: cost.json,
  };
}

/** The same three, for a partial update: a field absent from `input` is left
 *  untouched, and an explicit null clears both of its columns. */
export function partialPriceColumns(input: {
  price?: MoneySet;
  compareAtPrice?: MoneySet | null;
  costPrice?: MoneySet | null;
}) {
  const out: Record<string, unknown> = {};
  if (input.price !== undefined) {
    const c = moneyCol(input.price);
    out.price = c.mirror;
    out.priceMoney = c.json;
  }
  if (input.compareAtPrice !== undefined) {
    const c = optionalMoneyCol(input.compareAtPrice);
    out.compareAtPrice = c.mirror;
    out.compareAtPriceMoney = c.json;
  }
  if (input.costPrice !== undefined) {
    const c = optionalMoneyCol(input.costPrice);
    out.costPrice = c.mirror;
    out.costPriceMoney = c.json;
  }
  return out;
}

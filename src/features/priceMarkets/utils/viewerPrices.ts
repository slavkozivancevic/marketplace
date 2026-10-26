import { moneyUsdCents, type MoneySet } from "@/lib/money";
import { applyMarket, type MarketRules, type MarketViewer, type SchedulePricing } from "@/features/pricing/engine/market";
import type { SerializedProductListItem, SerializedPublicProduct } from "@/types/types";

/** The market rule that set a shown price, for the "price for {country}" label. */
export type AppliedMarketRule = { id: string; name: string } | null;

type Priced = {
  price: number;
  priceMoney: MoneySet;
  compareAtPrice: number | null;
  compareAtPriceMoney: MoneySet | null;
  schedule: SchedulePricing;
};

/**
 * One target's money fields as this viewer sees them, written back under the
 * names every price component already reads - mirrors included, so a component
 * comparing `compareAtPrice` against `price` agrees with the sets.
 */
function priceFor<T extends Priced>(
  target: T,
  variantId: string | null,
  rules: MarketRules,
  viewer: MarketViewer,
  compareAtMoney: MoneySet | null = target.compareAtPriceMoney,
): T & { marketRule: AppliedMarketRule } {
  const r = applyMarket(
    { priceMoney: target.priceMoney, compareAtMoney, schedule: target.schedule },
    variantId,
    rules,
    viewer,
  );
  return {
    ...target,
    price: moneyUsdCents(r.priceMoney),
    priceMoney: r.priceMoney,
    compareAtPrice: r.compareAtMoney ? moneyUsdCents(r.compareAtMoney) : null,
    compareAtPriceMoney: r.compareAtMoney,
    marketRule: r.marketRule,
  };
}

/**
 * No market rule now and none ever changed: the neutral price is the price.
 * Typed as always present, but a payload serialized before market pricing
 * shipped (still in a browser's query cache across a deploy) lacks it, and a
 * missing field must read as "no rules", never as a crash on a product card.
 */
function hasNoMarketHistory(rules: MarketRules | undefined): boolean {
  return !rules || (rules.rules.length === 0 && Object.keys(rules.clocks).length === 0);
}

/** A card's product, priced for the viewer. Unchanged when no market rule exists. */
export function listItemForViewer<T extends SerializedProductListItem>(
  item: T,
  viewer: MarketViewer,
): T & { marketRule: AppliedMarketRule } {
  // The common case - no market rule ever - passes the prices through as they
  // came. `hasNoMarketHistory` also covers a payload from before markets
  // existed (an open tab across a deploy), which has no `marketRules` at all.
  if (hasNoMarketHistory(item.marketRules)) {
    return { ...item, marketRule: null };
  }
  return priceFor(item, null, item.marketRules, viewer);
}

/**
 * A product page's product, priced for the viewer: the product row and every
 * variant, each through its own rules.
 *
 * A variant without its own struck-through price inherits the product's on the
 * storefront (see `variantCompareAt`). After a market rule that inheritance
 * would borrow a "was" price computed for a different target, so each variant
 * comes out with its compare-at made explicit: the inherited one put through
 * the variant's own market rule, or - where the market leaves no reduction to
 * announce - its own price, which every surface reads as "no reduction" and
 * which stops the inheritance.
 */
export type ViewerPricedProduct<P extends SerializedPublicProduct> = Omit<P, "variants"> & {
  marketRule: AppliedMarketRule;
  variants: (P["variants"][number] & { marketRule: AppliedMarketRule })[];
};

export function productForViewer<P extends SerializedPublicProduct>(
  product: P,
  viewer: MarketViewer,
): ViewerPricedProduct<P> {
  const rules = product.marketRules;
  if (hasNoMarketHistory(rules)) {
    return {
      ...product,
      marketRule: null,
      variants: product.variants.map((v) => ({ ...v, marketRule: null })),
    };
  }
  return {
    ...priceFor(product, null, rules, viewer),
    variants: product.variants.map((v) => {
      const inherited = v.compareAtPriceMoney ?? product.compareAtPriceMoney;
      const priced = priceFor(v, v.id, rules, viewer, inherited);
      if (priced.compareAtPriceMoney !== null || inherited === null) return priced;
      return { ...priced, compareAtPrice: priced.price, compareAtPriceMoney: priced.priceMoney };
    }),
  };
}

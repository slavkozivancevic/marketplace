import { prisma } from "@/core/db/prisma";
import {
  moneyIn,
  moneyUsdCents,
  parseMoney,
  requireMoney,
  type CurrencyRates,
  type MoneySet,
} from "@/lib/money";
import type { Currency } from "@/lib/currency-config";
import { ensurePricesCurrent } from "@/features/pricing/db/roll";
import {
  marketRulesInclude,
  marketRulesOf,
  schedulePricing,
  variantCompareAt,
} from "@/features/pricing/db/projection";
import { applyMarket, type MarketViewer } from "@/features/pricing/engine/market";

/** A cart line as the client knows it. Prices are intentionally absent - they
 *  are snapshots on the client and are always re-read from the DB here. */
export type CartItemRef = { productId: string; variantId: string | null; quantity: number };

/** A cart line resolved against live DB state: a real, purchasable product (or
 *  variant) with its authoritative price and owning org. */
export type ResolvedCartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  /** Authoritative USD-cent mirror - the basis for coupon minimums, shipping
   *  thresholds and any other cross-currency comparison. Never displayed. */
  unitPriceUsd: number;
  /** The authoritative price as an exact per-currency set. What a buyer is
   *  actually charged comes from here via `moneyIn`, never by converting
   *  `unitPriceUsd` - that round trip is what made the charged amount differ
   *  from the price shown on the product page. `Product.priceMoney` and
   *  `ProductVariant.priceMoney` are NOT NULL, so a resolved line always has
   *  one - an unpriceable row cannot become a line, it becomes `unavailable`. */
  unitMoney: MoneySet;
  /** The struck-through "was" price, when this line is on sale; null otherwise.
   *  Authoritative like `unitMoney` and carried for the same reason: the cart
   *  shows the saving, and a saving computed from a client snapshot can outlive
   *  the sale that produced it. Null is a real answer - not on sale. */
  unitCompareAtMoney: MoneySet | null;
  organizationId: string;
  /** The price rule that set `unitMoney`, and its label, snapshotted onto the
   *  order line at checkout; both null when the base price applies. */
  priceRuleId: string | null;
  priceRuleLabel: string | null;
  /** The market rule applied on top for the buyer's country, snapshotted the
   *  same way; both null when the buyer's market has none for this line. */
  marketRuleId: string | null;
  marketRuleLabel: string | null;
};

export type CartResolution = {
  /** Lines backed by a live, purchasable product/variant. */
  lines: ResolvedCartLine[];
  /** Refs that no longer resolve - the product was deleted/unpublished, or the
   *  variant id is stale (e.g. the seller re-saved the product and its variants
   *  were regenerated). The client should prune these and tell the buyer. */
  unavailable: CartItemRef[];
  /** Subtotal of the resolvable lines (USD base cents). */
  subtotalUsd: number;
};

/**
 * The single source of truth for "what is this cart actually worth, and is
 * every line still purchasable". Coupon eligibility, per-seller shipping and the
 * order summary all build on this so they can never disagree with each other -
 * or with checkout - about the cart's value.
 *
 * Prices are always read from the DB (client snapshots are never trusted), and
 * an item that doesn't resolve is reported in `unavailable` rather than silently
 * counted as zero - the bug that let a stale line drag a cart below a coupon's
 * minimum while the UI still showed the old price.
 *
 * "Purchasable" matches checkout: the product must be PUBLISHED and not deleted,
 * and a referenced variant must still exist under it.
 *
 * Prices are the EFFECTIVE ones - the base price with any active price rule
 * applied, exactly what the product page shows right now. Due rows are rolled
 * first, so a cart resolved one second after a promo ends is already back on
 * the base price.
 *
 * Then the buyer's market: `viewer` is whose cart this is (`getViewerMarket()`
 * in every caller), and the same `applyMarket` the storefront runs in the
 * browser puts its market rule on top - so the cart, the coupon minimum, the
 * free-shipping threshold and the charge all agree with the product page. It
 * is required, not optional, so no caller can price a cart for nobody.
 */
export async function resolveCart(items: CartItemRef[], viewer: MarketViewer): Promise<CartResolution> {
  if (items.length === 0) return { lines: [], unavailable: [], subtotalUsd: 0 };

  await ensurePricesCurrent();

  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
  const productIds = items.filter((i) => !i.variantId).map((i) => i.productId);
  const effective = {
    effectivePrice: true,
    effectivePriceMoney: true,
    effectiveCompareAtPriceMoney: true,
    effectiveRuleId: true,
    effectiveRuleLabel: true,
    effectiveSince: true,
  } as const;
  const market = { marketRuleClocks: true, ...marketRulesInclude } as const;
  const [variants, products] = await Promise.all([
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            ...effective,
            product: {
              select: {
                id: true,
                organizationId: true,
                status: true,
                deletedAt: true,
                effectiveCompareAtPriceMoney: true,
                effectiveRuleId: true,
                ...market,
              },
            },
          },
        })
      : [],
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            ...effective,
            ...market,
            organizationId: true,
            status: true,
            deletedAt: true,
          },
        })
      : [],
  ]);

  /** One line's money for this buyer: the neutral price with their market on top. */
  const forViewer = (
    row: { effectivePrice: number; effectivePriceMoney: unknown; effectiveRuleId: string | null; effectiveSince: Date | null },
    compareAtMoney: MoneySet | null,
    variantId: string | null,
    owner: { priceRules: Parameters<typeof marketRulesOf>[0]["priceRules"]; marketRuleClocks: unknown },
    label: string,
  ) => {
    const neutral = requireMoney(row.effectivePriceMoney, label);
    const r = applyMarket(
      { priceMoney: neutral, compareAtMoney, schedule: schedulePricing(row) },
      variantId,
      marketRulesOf(owner),
      viewer,
    );
    return {
      // The neutral mirror is kept as is when no market rule applies, so a
      // cart with no market rules prices exactly as it did before markets.
      unitPriceUsd: r.marketRule ? moneyUsdCents(r.priceMoney) : Number(row.effectivePrice),
      unitMoney: r.priceMoney,
      unitCompareAtMoney: r.compareAtMoney,
      marketRuleId: r.marketRule?.id ?? null,
      marketRuleLabel: r.marketRule?.name ?? null,
    };
  };
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const purchasable = (p: { status: string; deletedAt: Date | null }) =>
    p.status === "PUBLISHED" && p.deletedAt === null;

  const lines: ResolvedCartLine[] = [];
  const unavailable: CartItemRef[] = [];
  let subtotalUsd = 0;

  for (const it of items) {
    if (it.variantId) {
      const v = variantMap.get(it.variantId);
      if (!v || !purchasable(v.product)) {
        unavailable.push(it);
        continue;
      }
      const priced = forViewer(
        v,
        variantCompareAt(v, v.product),
        v.id,
        v.product,
        `ProductVariant.effectivePriceMoney on ${v.id}`,
      );
      lines.push({
        productId: v.product.id,
        variantId: it.variantId,
        quantity: it.quantity,
        ...priced,
        organizationId: v.product.organizationId,
        priceRuleId: v.effectiveRuleId,
        priceRuleLabel: v.effectiveRuleLabel,
      });
      subtotalUsd += priced.unitPriceUsd * it.quantity;
    } else {
      const p = productMap.get(it.productId);
      if (!p || !purchasable(p)) {
        unavailable.push(it);
        continue;
      }
      const priced = forViewer(
        p,
        parseMoney(p.effectiveCompareAtPriceMoney),
        null,
        p,
        `Product.effectivePriceMoney on ${p.id}`,
      );
      lines.push({
        productId: it.productId,
        variantId: null,
        quantity: it.quantity,
        ...priced,
        organizationId: p.organizationId,
        priceRuleId: p.effectiveRuleId,
        priceRuleLabel: p.effectiveRuleLabel,
      });
      subtotalUsd += priced.unitPriceUsd * it.quantity;
    }
  }

  return { lines, unavailable, subtotalUsd };
}

/**
 * The cart's value in a given currency, summed line by line.
 *
 * Per line, never one conversion of `subtotalUsd`: each line already has an
 * exact amount stored for this currency, and converting the USD total instead
 * rounds differently from the prices the buyer was shown. That difference is
 * what puts a cart a dinar either side of a coupon minimum or a free-shipping
 * threshold, so every threshold comparison uses this.
 */
export function cartSubtotalIn(
  lines: ResolvedCartLine[],
  currency: Currency,
  rates?: CurrencyRates,
): number {
  return lines.reduce(
    (sum, line) => sum + moneyIn(line.unitMoney, currency, rates) * line.quantity,
    0,
  );
}

/**
 * A line's authoritative price, shaped for the client's cart snapshot.
 *
 * The store snapshots a price at add-to-cart time and persists it, so it goes
 * stale the moment the seller edits that product. Sending the resolved price
 * back lets the cart refresh its own snapshot - without it the page renders one
 * total while checkout, which always re-reads the DB, charges another.
 */
export type CartLinePrice = {
  productId: string;
  variantId: string | null;
  unitPriceUsd: number;
  unitMoney: MoneySet;
  /** Null means "no longer on sale", and the client must apply that too - a
   *  snapshot kept from add-to-cart time would keep striking through a price
   *  the seller has since withdrawn. */
  unitCompareAtMoney: MoneySet | null;
};

/** The resolved lines reduced to what the client needs to re-snapshot. */
export function cartLinePrices(lines: ResolvedCartLine[]): CartLinePrice[] {
  return lines.map(
    ({ productId, variantId, unitPriceUsd, unitMoney, unitCompareAtMoney }) => ({
      productId,
      variantId,
      unitPriceUsd,
      unitMoney,
      unitCompareAtMoney,
    }),
  );
}

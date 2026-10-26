import "server-only";
import { prisma } from "@/core/db/prisma";
import { moneyUsdCents } from "@/lib/money";
import { Prisma } from "@/generated/prisma/client";
import { applyMarket, type MarketViewer } from "@/features/pricing/engine/market";
import {
  marketRulesInclude,
  marketRulesOf,
  publicMoneyFields,
  schedulePricing,
} from "@/features/pricing/db/projection";
import { ensurePricesCurrent } from "@/features/pricing/db/roll";
import { buildPublicProductWhere } from "@/features/products/db/publicProducts";

/**
 * Products the neutral "on sale" filter lists but whose card shows THIS viewer
 * no reduction - their market withholds the Omnibus reference, or prices them
 * with a fixed amount. Listing them as on sale would announce a reduction the
 * card cannot back up, so the filter and its count leave them out.
 *
 * Exclusions are the whole story: a market rule can take a sale away but never
 * create one (percent and amount-off are monotonic, a fixed price never strikes
 * through), so the viewer's sale set is the neutral one minus these.
 *
 * Only products with market history can differ, which on most shops is none -
 * one small query, and the same `applyMarket` the card runs, from the same
 * columns. Never cached: the viewer must not become part of a cache key.
 */
export async function marketSaleExclusions(viewer: MarketViewer): Promise<string[]> {
  // The listing rolls due windows before it reads; so does this, or the two
  // would judge a promo that just opened or closed from different columns.
  await ensurePricesCurrent();
  const rows = await prisma.product.findMany({
    where: {
      AND: [
        buildPublicProductWhere({ onSale: true }),
        {
          OR: [
            { marketRuleClocks: { not: Prisma.DbNull } },
            { priceRules: { some: { kind: "REGION", active: true } } },
          ],
        },
      ],
    },
    select: {
      id: true,
      costPrice: true,
      effectivePrice: true,
      effectivePriceMoney: true,
      effectiveCompareAtPrice: true,
      effectiveCompareAtPriceMoney: true,
      effectiveRuleId: true,
      effectiveRuleLabel: true,
      effectiveUntil: true,
      effectiveSince: true,
      marketRuleClocks: true,
      ...marketRulesInclude,
    },
  });

  const excluded: string[] = [];
  for (const row of rows) {
    const money = publicMoneyFields(row);
    const priced = applyMarket(
      { priceMoney: money.priceMoney, compareAtMoney: money.compareAtPriceMoney, schedule: schedulePricing(row) },
      null,
      marketRulesOf(row),
      viewer,
    );
    // The card's own test: a struck-through price strictly above the price.
    const onSale =
      priced.compareAtMoney !== null && moneyUsdCents(priced.compareAtMoney) > moneyUsdCents(priced.priceMoney);
    if (!onSale) excluded.push(row.id);
  }
  return excluded;
}

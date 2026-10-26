import "server-only";
import { prisma, type TransactionClient } from "@/core/db/prisma";
import { requireMoney } from "@/lib/money";
import { buildWindows, type PriceTarget } from "../engine/windows";
import { PRICE_WINDOW_HORIZON_DAYS } from "../schema/priceRules";
import { toEngineRule } from "./rules";

const DAY_MS = 86_400_000;

type Db = TransactionClient | typeof prisma;

/**
 * Rebuilds every price window of one product - the product row and each of its
 * variants - from its current rules, `PRICE_WINDOW_HORIZON_DAYS` ahead, and
 * marks all of them due so the next reader rolls the new state in.
 *
 * Idempotent: the windows are a pure function of the rules, so running it twice
 * leaves the same rows (with new ids) and the same prices.
 *
 * Generation starts in the past on purpose. The window covering `now` must keep
 * its REAL start, because the Omnibus reference price looks at the 30 days
 * before the reduction began; clipping it to `now` would put the promo's own
 * price inside that lookback and silently remove the strike-through. A
 * recurring occurrence lasts at most a day, so one day back covers it; a
 * one-off rule still running reaches back to its own start.
 */
export async function regenerateProductWindows(
  db: Db,
  productId: string,
  now: Date = new Date(),
): Promise<{ windows: number }> {
  const [product, rules] = await Promise.all([
    db.product.findUniqueOrThrow({
      where: { id: productId },
      select: { id: true, priceMoney: true, variants: { select: { id: true, priceMoney: true } } },
    }),
    db.priceRule.findMany({ where: { productId, active: true, kind: "SCHEDULE" } }),
  ]);

  const engineRules = rules.map(toEngineRule);
  const to = new Date(now.getTime() + PRICE_WINDOW_HORIZON_DAYS * DAY_MS);
  const from = new Date(
    Math.min(
      now.getTime() - DAY_MS,
      ...engineRules
        .filter((r) => r.recurrence === "NONE" && r.endsAt !== null && r.endsAt > now)
        .map((r) => r.startsAt.getTime()),
    ),
  );

  const targets: PriceTarget[] = [
    { productId, variantId: null, baseMoney: requireMoney(product.priceMoney, `Product ${productId}`) },
    ...product.variants.map((v) => ({
      productId,
      variantId: v.id,
      baseMoney: requireMoney(v.priceMoney, `ProductVariant ${v.id}`),
    })),
  ];
  const drafts = targets.flatMap((t) => buildWindows(t, engineRules, from, to));

  await db.priceWindow.deleteMany({ where: { productId } });
  if (drafts.length > 0) {
    await db.priceWindow.createMany({
      data: drafts.map((d) => ({
        productId: d.productId,
        variantId: d.variantId,
        ruleId: d.ruleId,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
      })),
    });
  }
  // Writing `effectiveUntil` alone does not fire the base-price triggers.
  await db.product.update({ where: { id: productId }, data: { effectiveUntil: now } });
  await db.productVariant.updateMany({ where: { productId }, data: { effectiveUntil: now } });

  return { windows: drafts.length };
}

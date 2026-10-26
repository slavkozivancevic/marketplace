import "server-only";
import { prisma } from "@/core/db/prisma";
import { moneyCol, optionalMoneyCol } from "@/core/db/moneyColumns";
import { parseMoney, requireMoney, type MoneySet } from "@/lib/money";
import { VALID_CURRENCIES } from "@/lib/currency-config";
import { rollTarget, type RolledState } from "../engine/roll";
import { PRICE_REFERENCE_LOOKBACK_DAYS } from "../schema/priceRules";
import { toEngineRule } from "./rules";

const DAY_MS = 86_400_000;
/** Rows rolled per call. A backlog larger than this drains over the next reads. */
const ROLL_BATCH = 200;

/**
 * Brings every due read-model row up to date, then returns.
 *
 * Call it at the top of any reader that shows or charges a price. In the
 * normal case nothing is due and this is ONE indexed query - which is what lets
 * prices flip on time with no cron at all: the first read after a boundary
 * does the flip.
 *
 * The roll runs on the database's clock, read in the same query that found the
 * rows due. The base-price trigger marks a row due at the database's
 * `CURRENT_TIMESTAMP`; rolling with the app's clock instead would, whenever
 * that clock lags the database's, see the row as due here and then find nothing
 * to roll - the seller saves a new base price and reads back the old one.
 */
export async function ensurePricesCurrent(): Promise<void> {
  const [{ due, now }] = await prisma.$queryRaw<{ due: boolean; now: Date }[]>`
    SELECT (
      EXISTS (SELECT 1 FROM "Product" WHERE "effectiveUntil" <= NOW())
      OR EXISTS (SELECT 1 FROM "ProductVariant" WHERE "effectiveUntil" <= NOW())
    ) AS due, NOW() AS now
  `;
  if (!due) return;
  await rollDue(now);
}

/** Rolls the due rows. Exported for tests and for the horizon route. */
export async function rollDue(now: Date): Promise<{ rolled: number }> {
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { effectiveUntil: { lte: now } },
      select: { id: true, priceMoney: true, compareAtPriceMoney: true },
      take: ROLL_BATCH,
    }),
    prisma.productVariant.findMany({
      where: { effectiveUntil: { lte: now } },
      select: { id: true, productId: true, priceMoney: true, compareAtPriceMoney: true },
      take: ROLL_BATCH,
    }),
  ]);

  let rolled = 0;
  for (const p of products) {
    if (await rollOne({ kind: "product", id: p.id, productId: p.id, variantId: null, row: p }, now)) {
      rolled++;
    }
  }
  for (const v of variants) {
    if (
      await rollOne({ kind: "variant", id: v.id, productId: v.productId, variantId: v.id, row: v }, now)
    ) {
      rolled++;
    }
  }
  return { rolled };
}

type DueRow = {
  kind: "product" | "variant";
  id: string;
  productId: string;
  variantId: string | null;
  row: { priceMoney: unknown; compareAtPriceMoney: unknown };
};

async function rollOne(target: DueRow, now: Date): Promise<boolean> {
  const where = { productId: target.productId, variantId: target.variantId };
  const [activeWindow, nextWindow] = await Promise.all([
    prisma.priceWindow.findFirst({
      where: { ...where, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "desc" },
    }),
    prisma.priceWindow.findFirst({
      where: { ...where, startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    }),
  ]);
  const ruleRow = activeWindow
    ? await prisma.priceRule.findUnique({ where: { id: activeWindow.ruleId } })
    : null;

  const reductionStart = activeWindow?.startsAt ?? now;
  const lookbackFrom = new Date(reductionStart.getTime() - PRICE_REFERENCE_LOOKBACK_DAYS * DAY_MS);
  const pointRows = await prisma.pricePoint.findMany({
    where: { ...where, OR: [{ endedAt: null }, { endedAt: { gt: lookbackFrom } }] },
    orderBy: { startedAt: "asc" },
  });

  const label = `${target.kind} ${target.id}`;
  const state = rollTarget({
    base: {
      priceMoney: requireMoney(target.row.priceMoney, `priceMoney on ${label}`),
      compareAtMoney: parseMoney(target.row.compareAtPriceMoney),
    },
    // A window whose rule has since been deleted prices nothing.
    active:
      activeWindow && ruleRow
        ? { rule: toEngineRule(ruleRow), startsAt: activeWindow.startsAt, endsAt: activeWindow.endsAt }
        : null,
    nextStart: nextWindow?.startsAt ?? null,
    points: pointRows.map((p) => ({
      priceMoney: requireMoney(p.priceMoney, `PricePoint ${p.id}`),
      startedAt: p.startedAt,
      endedAt: p.endedAt,
    })),
  });

  return writeState(target, state, now);
}

/**
 * Writes the new state, guarded so that two readers rolling the same row at
 * once write it - and its ledger point - exactly once: only the update that
 * still finds the row due goes on to touch the ledger.
 */
async function writeState(target: DueRow, state: RolledState, now: Date): Promise<boolean> {
  const price = moneyCol(state.priceMoney);
  const compareAt = optionalMoneyCol(state.compareAtMoney);
  const data = {
    effectivePrice: price.mirror,
    effectivePriceMoney: price.json,
    effectiveCompareAtPrice: compareAt.mirror,
    effectiveCompareAtPriceMoney: compareAt.json,
    effectiveRuleId: state.ruleId,
    effectiveRuleLabel: state.ruleLabel,
    effectiveUntil: state.until,
    effectiveSince: state.since,
  };

  return prisma.$transaction(async (tx) => {
    const guard = { id: target.id, effectiveUntil: { lte: now } };
    const { count } =
      target.kind === "product"
        ? await tx.product.updateMany({ where: guard, data })
        : await tx.productVariant.updateMany({ where: guard, data });
    if (count === 0) return false;

    const ledgerWhere = { productId: target.productId, variantId: target.variantId, endedAt: null };
    const open = await tx.pricePoint.findFirst({ where: ledgerWhere, orderBy: { startedAt: "desc" } });
    if (!open || !sameAmounts(parseMoney(open.priceMoney), state.priceMoney)) {
      await tx.pricePoint.updateMany({ where: ledgerWhere, data: { endedAt: now } });
      await tx.pricePoint.create({
        data: {
          productId: target.productId,
          variantId: target.variantId,
          price: price.mirror,
          priceMoney: price.json,
          startedAt: now,
        },
      });
    }
    return true;
  });
}

function sameAmounts(a: MoneySet | null, b: MoneySet): boolean {
  return a !== null && VALID_CURRENCIES.every((c) => a.amounts[c] === b.amounts[c]);
}

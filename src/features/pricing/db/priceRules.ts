import "server-only";
import { prisma, type TransactionClient } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { optionalMoneyCol } from "@/core/db/moneyColumns";
import type { MoneySet } from "@/lib/money";
import { LimitReachedError, NotFoundError } from "@/features/common/errors/domainErrors";
import { PRICE_RULES_PER_PRODUCT_MAX } from "../schema/priceRules";
import type { RuleColumns } from "../schema/ruleMapping";
import { ruleClockKey } from "../engine/market";
import { regenerateProductWindows } from "./windows";

export type RuleWrite = RuleColumns & { amountMoney: MoneySet | null };

function data(write: RuleWrite) {
  const amount = optionalMoneyCol(write.amountMoney);
  const { amountMoney: _set, ...columns } = write;
  void _set;
  return { ...columns, amount: amount.mirror, amountMoney: amount.json };
}

/**
 * Locks the product row for the rest of the transaction, so two rule writes on
 * one product serialise - otherwise both could pass the limit check and land
 * rule 21 and 22. Also the tenant check: a product outside the org is "not
 * found", never "forbidden", so ids from another tenant reveal nothing.
 */
async function lockProduct(tx: TransactionClient, organizationId: string, productId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE id = ${productId} AND "organizationId" = ${organizationId} AND "deletedAt" IS NULL
    FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundError(`Product ${productId} not found`);
}

async function assertVariantOf(tx: TransactionClient, productId: string, variantId: string | null) {
  if (variantId === null) return;
  const v = await tx.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
  if (!v) throw new NotFoundError(`Variant ${variantId} not found on product ${productId}`);
}

async function assertMarketExists(tx: TransactionClient, marketId: string | null) {
  if (marketId === null) return;
  const m = await tx.priceMarket.findUnique({ where: { id: marketId }, select: { id: true } });
  if (!m) throw new NotFoundError(`PriceMarket ${marketId} not found`);
}

/**
 * Records that this product's market rules aimed at these targets changed.
 * Market prices are computed per viewer and never stored, so these per-target
 * timestamps are all the read path has to decide whether a buyer's last 30
 * days can be reconstructed for the Omnibus reference - see `applyMarket`.
 * Callers pass every target the rule had OR now has: a rule moved from
 * Eurozone to Germany changed both.
 *
 * Raw SQL, on purpose twice over: Prisma's `@updatedAt` would also bump the
 * product's own `updatedAt` (a rule edit is not a product edit), and the
 * database's clock is the one every other pricing timestamp uses.
 * `CURRENT_TIMESTAMP` is a timestamptz, so each JSON string carries its
 * offset; no JS `Date` is bound - see the CLAUDE.md note on
 * `timestamp without time zone`.
 */
async function touchMarketRules(
  tx: TransactionClient,
  productId: string,
  rules: readonly { countryCode: string | null; marketId: string | null }[],
) {
  const keys = [...new Set(rules.map(ruleClockKey).filter((k): k is string => k !== null))];
  if (keys.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Product"
    SET "marketRuleClocks" = COALESCE("marketRuleClocks", '{}'::jsonb)
      || (SELECT jsonb_object_agg(k, to_jsonb(CURRENT_TIMESTAMP)) FROM unnest(${keys}::text[]) AS k)
    WHERE id = ${productId}
  `;
}

/** A rule in the org, or NotFoundError. */
export async function getRule(organizationId: string, ruleId: string) {
  const rule = await prisma.priceRule.findFirst({ where: { id: ruleId, organizationId } });
  if (!rule) throw new NotFoundError(`Price rule ${ruleId} not found`);
  return rule;
}

/**
 * Creates a rule and rebuilds the product's windows in the same transaction.
 * The limit is enforced HERE, not only in the form: a write that skips the form
 * must not skip the limit.
 */
export async function createRule(input: {
  organizationId: string;
  productId: string;
  userId: string;
  write: RuleWrite;
}) {
  return prisma.$transaction(async (tx) => {
    await lockProduct(tx, input.organizationId, input.productId);
    await assertVariantOf(tx, input.productId, input.write.variantId);
    await assertMarketExists(tx, input.write.marketId);
    // Schedule and market rules count together: the limit is about how much a
    // seller can attach to one product, not about one kind of rule.
    const count = await tx.priceRule.count({ where: { productId: input.productId } });
    if (count >= PRICE_RULES_PER_PRODUCT_MAX) {
      throw new LimitReachedError({
        key: "priceRuleLimitReached",
        params: { max: PRICE_RULES_PER_PRODUCT_MAX },
      });
    }
    const rule = await tx.priceRule.create({
      data: {
        ...data(input.write),
        organizationId: input.organizationId,
        productId: input.productId,
        createdById: input.userId,
        updatedById: input.userId,
      },
    });
    if (rule.kind === "REGION") await touchMarketRules(tx, input.productId, [rule]);
    else await regenerateProductWindows(tx, input.productId);
    return rule;
  });
}

export async function updateRule(input: {
  organizationId: string;
  ruleId: string;
  userId: string;
  write: RuleWrite;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.priceRule.findFirst({
      where: { id: input.ruleId, organizationId: input.organizationId },
    });
    if (!existing) throw new NotFoundError(`Price rule ${input.ruleId} not found`);
    // The form never offers it; only a forged request gets here. A schedule
    // rule and a market rule are different things, not two states of one.
    if (existing.kind !== input.write.kind) {
      throw new Error(`Price rule ${input.ruleId} cannot change kind`);
    }
    await lockProduct(tx, input.organizationId, existing.productId);
    await assertVariantOf(tx, existing.productId, input.write.variantId);
    await assertMarketExists(tx, input.write.marketId);
    const rule = await tx.priceRule.update({
      where: { id: existing.id },
      data: { ...data(input.write), updatedById: input.userId },
    });
    if (rule.kind === "REGION") await touchMarketRules(tx, existing.productId, [existing, rule]);
    else await regenerateProductWindows(tx, existing.productId);
    return { before: existing, rule };
  });
}

/**
 * A copy of a rule, PAUSED. Live, it would apply in exactly the source's slot
 * and - being newer - win the tie against it, silently re-pricing the shop the
 * moment it was made; paused, it changes nothing until the seller has edited
 * its dates or target and switched it on. The same reason a duplicated trust
 * point or category starts hidden.
 *
 * Under the product lock and the per-product limit, like `createRule`: a copy
 * is a new rule. Paused, it produces no windows and moves no market price, so
 * neither the windows nor `marketRuleClocks` need touching here - the edit
 * that switches it on does both.
 */
export async function duplicateRule(input: {
  organizationId: string;
  ruleId: string;
  userId: string;
  name: (sourceName: string) => string;
}) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.priceRule.findFirst({
      where: { id: input.ruleId, organizationId: input.organizationId },
    });
    if (!source) throw new NotFoundError(`Price rule ${input.ruleId} not found`);
    await lockProduct(tx, input.organizationId, source.productId);
    const count = await tx.priceRule.count({ where: { productId: source.productId } });
    if (count >= PRICE_RULES_PER_PRODUCT_MAX) {
      throw new LimitReachedError({
        key: "priceRuleLimitReached",
        params: { max: PRICE_RULES_PER_PRODUCT_MAX },
      });
    }
    const { id: _id, createdAt: _c, updatedAt: _u, amountMoney, ...columns } = source;
    void _id;
    void _c;
    void _u;
    const copy = await tx.priceRule.create({
      data: {
        ...columns,
        amountMoney: amountMoney ?? Prisma.DbNull,
        name: input.name(source.name),
        active: false,
        createdById: input.userId,
        updatedById: input.userId,
      },
    });
    return { copy, source };
  });
}

export async function deleteRule(input: { organizationId: string; ruleId: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.priceRule.findFirst({
      where: { id: input.ruleId, organizationId: input.organizationId },
    });
    if (!existing) throw new NotFoundError(`Price rule ${input.ruleId} not found`);
    await lockProduct(tx, input.organizationId, existing.productId);
    await tx.priceRule.delete({ where: { id: existing.id } });
    if (existing.kind === "REGION") await touchMarketRules(tx, existing.productId, [existing]);
    else await regenerateProductWindows(tx, existing.productId);
    return existing;
  });
}

/**
 * Called by the variant sync before it hard-deletes variants: their rules go
 * first, explicitly, in the same transaction - the FK is Restrict precisely so
 * that nothing ever cascades them away unseen. Returns what was deleted so the
 * caller can audit each rule.
 */
export async function deleteRulesOfVariants(tx: TransactionClient, variantIds: string[]) {
  if (variantIds.length === 0) return [];
  const rules = await tx.priceRule.findMany({
    where: { variantId: { in: variantIds } },
    select: {
      id: true,
      name: true,
      productId: true,
      variantId: true,
      kind: true,
      marketId: true,
      countryCode: true,
    },
  });
  if (rules.length === 0) return [];
  await tx.priceRule.deleteMany({ where: { id: { in: rules.map((r) => r.id) } } });
  await tx.priceWindow.deleteMany({ where: { variantId: { in: variantIds } } });
  const regionRules = rules.filter((r) => r.kind === "REGION");
  for (const productId of new Set(regionRules.map((r) => r.productId))) {
    await touchMarketRules(tx, productId, regionRules.filter((r) => r.productId === productId));
  }
  return rules;
}

"use server";

import { updateTag } from "next/cache";
import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { recordAudit } from "@/features/audit/db/audit";
import { getCurrencyRates } from "@/features/currency/db/currencyRates";
import { revalidateProductCache } from "@/features/products/db/cache";
import { buildMoneySet, preserveDerived } from "@/lib/money-input";
import { parseMoney, type MoneySet } from "@/lib/money";
import { CacheTags } from "@/lib/cache/tags";
import type { ActionErrorResult } from "@/types/types";
import { getLocale } from "next-intl/server";
import { copyName } from "@/lib/i18n/copyName";
import { PRICE_RULE_NAME_MAX_LENGTH, priceRuleSchema, type PriceRuleInput } from "../schema/priceRules";
import { toRuleColumns } from "../schema/ruleMapping";
import {
  createRule,
  deleteRule,
  duplicateRule,
  getRule,
  updateRule,
  type RuleWrite,
} from "../db/priceRules";

type Saved = { ok: true; redirectTo: string } | ActionErrorResult;

/**
 * Form input -> what the db layer writes. Rates are read here, never trusted
 * from the request; on an edit, an amount the seller did not touch keeps the
 * derived currencies it already had (renaming a rule or moving its dates must
 * not re-price it at today's rate).
 */
async function toWrite(input: PriceRuleInput, storedAmount: unknown): Promise<RuleWrite> {
  const fixed = input.adjustment !== "PERCENT";
  let amountMoney: MoneySet | null = null;
  if (fixed) {
    const built = buildMoneySet(input.amount, await getCurrencyRates());
    amountMoney = preserveDerived(built, parseMoney(storedAmount));
  }
  return { ...toRuleColumns(input), amountMoney };
}

/** What a human can read back in the audit log. */
function auditDiff(c: RuleWrite) {
  if (c.kind === "REGION") {
    // A market rule has no schedule; its time columns are placeholders.
    return {
      kind: c.kind,
      name: c.name,
      variantId: c.variantId,
      marketId: c.marketId,
      countryCode: c.countryCode,
      adjustment: c.adjustment,
      percentBps: c.percentBps,
      amount: c.amountMoney ? c.amountMoney.amounts : null,
      priority: c.priority,
      active: c.active,
    };
  }
  return {
    kind: c.kind,
    name: c.name,
    variantId: c.variantId,
    adjustment: c.adjustment,
    percentBps: c.percentBps,
    amount: c.amountMoney ? c.amountMoney.amounts : null,
    recurrence: c.recurrence,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt?.toISOString() ?? null,
    timezone: c.timezone,
    priority: c.priority,
    active: c.active,
  };
}

/**
 * Every tag the actor reads back next gets `updateTag` (read-your-own-writes):
 * the rules list they return to, and the product. Server Actions only.
 */
function invalidate(organizationId: string, productId: string) {
  updateTag(CacheTags.priceRules.byProduct(organizationId, productId));
  revalidateProductCache(organizationId, productId);
}

async function parse(unsafe: PriceRuleInput) {
  return priceRuleSchema.safeParse(unsafe, { error: await getServerZodErrorMap() });
}

/** Hands the redirect target back instead of performing it - see createProduct. */
export async function createPriceRule(
  productId: string,
  unsafe: PriceRuleInput,
  redirectTo: string,
): Promise<Saved> {
  try {
    const parsed = await parse(unsafe);
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    // Role check AND the verification gate; a platform admin passes and acts
    // within the active org, like everywhere else.
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");

    const write = await toWrite(parsed.data, null);
    const rule = await createRule({
      organizationId: ctx.organizationId,
      productId,
      userId: ctx.userId,
      write,
    });

    invalidate(ctx.organizationId, productId);
    await recordAudit({
      action: "priceRule.created",
      entityType: "PriceRule",
      entityId: rule.id,
      diff: { productId, ...auditDiff(write) },
    });
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updatePriceRule(
  ruleId: string,
  unsafe: PriceRuleInput,
  redirectTo: string,
): Promise<Saved> {
  try {
    const parsed = await parse(unsafe);
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");

    const stored = await getRule(ctx.organizationId, ruleId);
    const write = await toWrite(parsed.data, stored.amountMoney);
    const { rule } = await updateRule({
      organizationId: ctx.organizationId,
      ruleId,
      userId: ctx.userId,
      write,
    });

    invalidate(ctx.organizationId, rule.productId);
    await recordAudit({
      action: "priceRule.updated",
      entityType: "PriceRule",
      entityId: rule.id,
      diff: { productId: rule.productId, ...auditDiff(write) },
    });
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Duplicates a rule, paused, and returns the copy's id so the list can offer
 * "Edit copy". The copy's name gets the "Copy of" prefix in the actor's
 * language - a rule name is one string the seller typed, not a per-locale set.
 * The audit line names the source, not its id (the duplicate convention).
 */
export async function duplicatePriceRule(
  ruleId: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const locale = await getLocale();

    const { copy, source } = await duplicateRule({
      organizationId: ctx.organizationId,
      ruleId,
      userId: ctx.userId,
      name: (sourceName) => copyName(locale, sourceName, PRICE_RULE_NAME_MAX_LENGTH),
    });

    invalidate(ctx.organizationId, copy.productId);
    await recordAudit({
      action: "priceRule.duplicated",
      entityType: "PriceRule",
      entityId: copy.id,
      diff: { productId: copy.productId, from: source.name, fromId: source.id },
    });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}

/** Deletes in place - the list row disappears with it, so there is nowhere to go. */
export async function deletePriceRule(ruleId: string): Promise<{ ok: true } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");

    const deleted = await deleteRule({ organizationId: ctx.organizationId, ruleId });

    invalidate(ctx.organizationId, deleted.productId);
    await recordAudit({
      action: "priceRule.deleted",
      entityType: "PriceRule",
      entityId: deleted.id,
      diff: { productId: deleted.productId, name: deleted.name },
    });
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

import "server-only";
import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import { parseMoney, requireMoney, type MoneySet } from "@/lib/money";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { toEngineRule } from "./rules";
import type { EngineRule } from "../schema/priceRules";

/** A variant's option labels, for `getVariantLabel` ("Yellow", "42 / White"). */
type VariantOptionRows = { option: { translations: { locale: string; label: string }[] } }[];

export type PricingPageData = {
  productId: string;
  organizationId: string;
  translations: { locale: string; title: string }[];
  baseMoney: MoneySet;
  variants: { id: string; sku: string; baseMoney: MoneySet; attributeValues: VariantOptionRows }[];
  rules: (EngineRule & { amountMoney: MoneySet | null })[];
};

/**
 * Everything the price-rules page shows, for one product of one org. Cached
 * under the rules tag (rule writes `updateTag` it) and the product tag (a
 * variant added or removed changes who a rule can target).
 */
export async function getPricingPageData(
  organizationId: string,
  productId: string,
): Promise<PricingPageData> {
  "use cache";
  cacheTag(CacheTags.priceRules.byProduct(organizationId, productId));
  cacheTag(CacheTags.products.byId(organizationId, productId));

  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      priceMoney: true,
      translations: { select: { locale: true, title: true } },
      variants: {
        select: {
          id: true,
          sku: true,
          priceMoney: true,
          // So the calendar can name a row "Yellow" instead of its SKU.
          attributeValues: { select: { option: { select: { translations: { select: { locale: true, label: true } } } } } },
        },
        orderBy: { order: "asc" },
      },
      priceRules: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!product) throw new NotFoundError(`Product ${productId} not found`);

  return {
    productId: product.id,
    organizationId: product.organizationId,
    translations: product.translations,
    baseMoney: requireMoney(product.priceMoney, `Product ${product.id}`),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      baseMoney: requireMoney(v.priceMoney, `ProductVariant ${v.id}`),
      attributeValues: v.attributeValues,
    })),
    rules: product.priceRules.map((r) => ({ ...toEngineRule(r), amountMoney: parseMoney(r.amountMoney) })),
  };
}

/** Price rules per variant id of one product - for the product form's warning. */
export async function getRuleCountByVariant(
  organizationId: string,
  productId: string,
): Promise<Record<string, number>> {
  "use cache";
  cacheTag(CacheTags.priceRules.byProduct(organizationId, productId));
  const rows = await prisma.priceRule.groupBy({
    by: ["variantId"],
    where: { organizationId, productId, variantId: { not: null } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.variantId!, r._count._all]));
}

/** One rule of the org with its product's variants, for the edit form. */
export async function getRuleForEdit(organizationId: string, ruleId: string) {
  "use cache";
  const rule = await prisma.priceRule.findFirst({ where: { id: ruleId, organizationId } });
  if (!rule) throw new NotFoundError(`Price rule ${ruleId} not found`);
  cacheTag(CacheTags.priceRules.byProduct(organizationId, rule.productId));
  return { rule: { ...toEngineRule(rule), amountMoney: parseMoney(rule.amountMoney) } };
}

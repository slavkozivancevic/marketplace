import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma, resetDb, createOrganization, createProduct } from "../../../../test/integration/helpers";
import type { RuleWrite } from "@/features/pricing/db/priceRules";
import type { MarketViewer } from "@/features/pricing/engine/market";
import { moneyCol } from "@/core/db/moneyColumns";
import { authorMoney } from "@/lib/money";

vi.mock("./cache", () => ({ revalidatePriceMarketCache: vi.fn() }));

const { createPriceMarket } = await import("./markets");
const { createRule } = await import("@/features/pricing/db/priceRules");
const { marketSaleExclusions } = await import("./saleExclusions");

const DAY = 86_400_000;
const usd = (cents: number) => moneyCol(authorMoney(cents, "usd", { usd: 1 }));

async function defaultMarket() {
  return prisma.priceMarket.create({
    data: { isDefault: true, translations: { create: [{ locale: "en", name: "Rest of world" }] } },
  });
}

function marketRule(over: Partial<RuleWrite>): RuleWrite {
  return {
    kind: "REGION",
    marketId: null,
    countryCode: null,
    name: "Eurozone +10%",
    variantId: null,
    adjustment: "PERCENT",
    percentBps: 1000,
    priority: 0,
    active: true,
    startsAt: new Date(0),
    endsAt: null,
    timezone: "UTC",
    recurrence: "NONE",
    startMinute: null,
    durationMinutes: null,
    weekdays: [],
    monthDay: null,
    amountMoney: null,
    ...over,
  };
}

/** A product inside a schedule promo: 8.00 now, struck-through 10.00, since an hour ago. */
async function promoProduct(organizationId: string) {
  const p = await createProduct({ organizationId, price: 1000 });
  const now = usd(800);
  const was = usd(1000);
  await prisma.product.update({
    where: { id: p.id },
    data: {
      effectivePrice: now.mirror,
      effectivePriceMoney: now.json,
      effectiveCompareAtPrice: was.mirror,
      effectiveCompareAtPriceMoney: was.json,
      effectiveRuleId: "promo",
      effectiveRuleLabel: "Promo -20%",
      effectiveSince: new Date(Date.now() - 3_600_000),
      effectiveUntil: null,
    },
  });
  return p;
}

/** Pretends the product's market rules last changed long before the promo's lookback. */
async function settleClocks(productId: string) {
  const row = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { marketRuleClocks: true } });
  const old = new Date(Date.now() - 90 * DAY).toISOString();
  const clocks = Object.fromEntries(Object.keys((row.marketRuleClocks ?? {}) as object).map((k) => [k, old]));
  await prisma.product.update({ where: { id: productId }, data: { marketRuleClocks: clocks } });
}

beforeEach(async () => {
  await resetDb();
});

describe("marketSaleExclusions", () => {
  it("excludes a sale whose market rule for the viewer changed inside the lookback, for that viewer only", async () => {
    const fallback = await defaultMarket();
    const org = await createOrganization();
    const eu = await createPriceMarket({ name: "Eurozone", translations: null, countries: ["DE"] });
    const p = await promoProduct(org.id);
    await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });

    const germany: MarketViewer = { country: "DE", marketId: eu.id, countryMovedAt: null };
    const serbia: MarketViewer = { country: "RS", marketId: fallback.id, countryMovedAt: null };
    expect(await marketSaleExclusions(germany)).toEqual([p.id]);
    expect(await marketSaleExclusions(serbia)).toEqual([]);
  });

  it("never looks at a product without market rules", async () => {
    const fallback = await defaultMarket();
    const org = await createOrganization();
    await promoProduct(org.id);
    const anyone: MarketViewer = { country: "DE", marketId: fallback.id, countryMovedAt: new Date() };
    expect(await marketSaleExclusions(anyone)).toEqual([]);
  });

  it("keeps a sale whose percent market rule is long settled - the strike moves with the price", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const eu = await createPriceMarket({ name: "Eurozone", translations: null, countries: ["DE"] });
    const p = await promoProduct(org.id);
    await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });
    await settleClocks(p.id);

    const germany: MarketViewer = { country: "DE", marketId: eu.id, countryMovedAt: null };
    expect(await marketSaleExclusions(germany)).toEqual([]);
  });

  it("excludes a sale the viewer's market prices at a fixed amount, however settled", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await promoProduct(org.id);
    await createRule({
      organizationId: org.id,
      productId: p.id,
      userId: "u",
      write: marketRule({
        countryCode: "DE",
        name: "Germany 7.00",
        adjustment: "FIXED_PRICE",
        percentBps: null,
        amountMoney: authorMoney(700, "usd", { usd: 1 }),
      }),
    });
    await settleClocks(p.id);

    const germany: MarketViewer = { country: "DE", marketId: null, countryMovedAt: null };
    expect(await marketSaleExclusions(germany)).toEqual([p.id]);
  });
});

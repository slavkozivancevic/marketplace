import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createOrganization,
  createProduct,
  createVariant,
} from "../../../../test/integration/helpers";
import type { RuleWrite } from "@/features/pricing/db/priceRules";
import { authorMoney } from "@/lib/money";

vi.mock("./cache", () => ({ revalidatePriceMarketCache: vi.fn() }));

const { createPriceMarket, updatePriceMarket, deletePriceMarket, duplicatePriceMarket, getPriceMarketConfig } =
  await import("./markets");
const { createRule, updateRule, deleteRule, duplicateRule } = await import("@/features/pricing/db/priceRules");
const { resolveCart } = await import("@/features/cart/db/resolveCart");
const { viewerFor } = await import("../utils/markets");
const { parseClocks } = await import("@/features/pricing/db/projection");
const { InUseError } = await import("@/features/common/errors/domainErrors");

/**
 * The migration seeds the default market, but every test starts from a
 * truncated database, so each one that needs it makes its own.
 */
async function defaultMarket() {
  return prisma.priceMarket.create({
    data: { isDefault: true, translations: { create: [{ locale: "en", name: "Rest of world" }] } },
  });
}

const named = (name: string, countries: string[] = []) => ({ name, translations: null, countries });

/** A market rule as the db layer receives it - the form is not under test here. */
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

beforeEach(async () => {
  await resetDb();
});

describe("price markets", () => {
  it("maps each country to its market, the rest to the default, and records each country's move", async () => {
    const fallback = await defaultMarket();
    const before = await getPriceMarketConfig();
    expect(before.countryMovedAt).toEqual({});

    const eu = await createPriceMarket(named("Eurozone", ["DE", "FR"]));
    const config = await getPriceMarketConfig();
    expect(config.defaultId).toBe(fallback.id);
    expect(config.byCountry).toEqual({ DE: eu.id, FR: eu.id });
    expect(Object.keys(config.countryMovedAt).sort()).toEqual(["DE", "FR"]);
    expect(viewerFor("FR", config).marketId).toBe(eu.id);
    expect(viewerFor("FR", config).countryMovedAt).toBe(config.countryMovedAt.FR);
    expect(viewerFor("US", config).marketId).toBe(fallback.id);
    expect(viewerFor("US", config).countryMovedAt).toBeNull();
    expect(viewerFor(null, config).marketId).toBe(fallback.id);
    expect(viewerFor(null, config).countryMovedAt).toBeNull();
  });

  it("refuses a country another market owns, naming it", async () => {
    await defaultMarket();
    await createPriceMarket(named("Eurozone", ["DE"]));
    await expect(createPriceMarket(named("DACH", ["AT", "DE"]))).rejects.toMatchObject({
      i18n: { key: "priceMarketCountryTaken", params: { countries: "DE" } },
    });
  });

  it("a rename records no move; adding or removing a country records only that country", async () => {
    await defaultMarket();
    const eu = await createPriceMarket(named("Eurozone", ["DE"]));
    const first = (await getPriceMarketConfig()).countryMovedAt;

    await updatePriceMarket(eu.id, named("Euro area", ["DE"]));
    expect((await getPriceMarketConfig()).countryMovedAt).toEqual(first);

    await new Promise((r) => setTimeout(r, 5));
    await updatePriceMarket(eu.id, named("Euro area", ["DE", "FR"]));
    const added = (await getPriceMarketConfig()).countryMovedAt;
    expect(added.DE).toBe(first.DE);
    expect(added.FR).toBeDefined();

    await new Promise((r) => setTimeout(r, 5));
    await updatePriceMarket(eu.id, named("Euro area", ["FR"]));
    const removed = (await getPriceMarketConfig()).countryMovedAt;
    expect(removed.DE).not.toBe(first.DE);
    expect(removed.FR).toBe(added.FR);
  });

  it("deleting a market records a move for each of its countries", async () => {
    await defaultMarket();
    const nordics = await createPriceMarket(named("Nordics", ["SE", "NO"]));
    const before = (await getPriceMarketConfig()).countryMovedAt;

    await new Promise((r) => setTimeout(r, 5));
    await deletePriceMarket(nordics.id);
    const after = (await getPriceMarketConfig()).countryMovedAt;
    expect(after.SE).not.toBe(before.SE);
    expect(after.NO).not.toBe(before.NO);
  });

  it("duplicates names per locale, without countries, never as a second default", async () => {
    const fallback = await defaultMarket();
    const eu = await createPriceMarket({
      name: "Eurozone",
      translations: { sr: { name: "Evrozona" }, de: { name: "Eurozone" }, es: { name: "Eurozona" } },
      countries: ["DE", "FR"],
    });
    const clock = (await getPriceMarketConfig()).countryMovedAt;

    const copy = await duplicatePriceMarket(eu.id);
    expect(copy.sourceName).toBe("Eurozone");
    const row = await prisma.priceMarket.findUniqueOrThrow({
      where: { id: copy.id },
      include: { translations: true, countries: true },
    });
    expect(Object.fromEntries(row.translations.map((t) => [t.locale, t.name]))).toEqual({
      en: "Copy of Eurozone",
      sr: "Kopija od Evrozona",
      de: "Kopie von Eurozone",
      es: "Copia de Eurozona",
    });
    expect(row.countries).toEqual([]);
    expect(row.isDefault).toBeNull();
    // No country moved, so no market price's Omnibus reference is disturbed.
    expect((await getPriceMarketConfig()).countryMovedAt).toEqual(clock);

    const ofDefault = await duplicatePriceMarket(fallback.id);
    expect((await prisma.priceMarket.findUniqueOrThrow({ where: { id: ofDefault.id } })).isDefault).toBeNull();
  });

  it("never deletes the default market", async () => {
    const fallback = await defaultMarket();
    await expect(deletePriceMarket(fallback.id)).rejects.toMatchObject({ i18n: { key: "priceMarketDefault" } });
  });

  it("refuses to delete a market that rules target, and deletes one that none do", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id });
    const eu = await createPriceMarket(named("Eurozone", ["DE"]));
    await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });

    await expect(deletePriceMarket(eu.id)).rejects.toBeInstanceOf(InUseError);

    const empty = await createPriceMarket(named("Nordics", ["SE"]));
    await expect(deletePriceMarket(empty.id)).resolves.toBe("Nordics");
    expect((await getPriceMarketConfig()).byCountry.SE).toBeUndefined();
  });
});

describe("market rules", () => {
  it("record per target when the product's market rules changed, on create, edit and delete", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id });
    const eu = await createPriceMarket(named("Eurozone", ["DE"]));
    const clocks = async () =>
      parseClocks((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).marketRuleClocks);
    const at = (iso: string | undefined) => Date.parse(iso ?? "");
    const euKey = `m:${eu.id}`;

    expect(await clocks()).toEqual({});
    const rule = await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });
    const created = await clocks();
    expect(Object.keys(created)).toEqual([euKey]);

    await new Promise((r) => setTimeout(r, 5));
    await updateRule({ organizationId: org.id, ruleId: rule.id, userId: "u", write: marketRule({ marketId: eu.id, percentBps: 500 }) });
    const edited = await clocks();
    expect(at(edited[euKey])).toBeGreaterThan(at(created[euKey]));

    // Moved to a country: the market it left and the country it reached both changed.
    await new Promise((r) => setTimeout(r, 5));
    await updateRule({
      organizationId: org.id,
      ruleId: rule.id,
      userId: "u",
      write: marketRule({ marketId: null, countryCode: "AT", percentBps: 500 }),
    });
    const moved = await clocks();
    expect(Object.keys(moved).sort()).toEqual(["c:AT", euKey].sort());
    expect(at(moved[euKey])).toBeGreaterThan(at(edited[euKey]));

    await new Promise((r) => setTimeout(r, 5));
    await deleteRule({ organizationId: org.id, ruleId: rule.id });
    const deleted = await clocks();
    expect(at(deleted["c:AT"])).toBeGreaterThan(at(moved["c:AT"]));
    expect(deleted[euKey]).toBe(moved[euKey]);
  });

  it("duplicates a rule paused, under the per-product limit", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id });
    const eu = await createPriceMarket(named("Eurozone", ["DE"]));
    const rule = await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });

    const { copy } = await duplicateRule({
      organizationId: org.id,
      ruleId: rule.id,
      userId: "u2",
      name: (n) => `Kopija od ${n}`,
    });
    expect(copy.id).not.toBe(rule.id);
    expect(copy.name).toBe("Kopija od Eurozone +10%");
    // Paused: live it would win the tie against its source and re-price the shop.
    expect(copy.active).toBe(false);
    expect(copy).toMatchObject({ kind: "REGION", marketId: eu.id, percentBps: 1000, createdById: "u2" });
    // The source is untouched.
    expect((await prisma.priceRule.findUniqueOrThrow({ where: { id: rule.id } })).active).toBe(true);

    for (let i = 2; i < 20; i++) {
      await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });
    }
    await expect(
      duplicateRule({ organizationId: org.id, ruleId: rule.id, userId: "u", name: (n) => n }),
    ).rejects.toMatchObject({ i18n: { key: "priceRuleLimitReached" } });
  });

  it("never lets a rule switch kind", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id });
    const rule = await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ countryCode: "DE" }) });
    await expect(
      updateRule({
        organizationId: org.id,
        ruleId: rule.id,
        userId: "u",
        write: { ...marketRule({}), kind: "SCHEDULE", startsAt: new Date(), endsAt: new Date(Date.now() + 7_200_000) },
      }),
    ).rejects.toThrow(/cannot change kind/);
  });

  it("the database refuses a market rule with no target or with both", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id });
    const base = {
      organizationId: org.id,
      productId: p.id,
      kind: "REGION" as const,
      name: "x",
      adjustment: "PERCENT" as const,
      percentBps: 1000,
      startsAt: new Date(0),
      timezone: "UTC",
      weekdays: [],
    };
    await expect(prisma.priceRule.create({ data: base })).rejects.toThrow(/PriceRule_region_target/);
    const m = await defaultMarket();
    await expect(prisma.priceRule.create({ data: { ...base, marketId: m.id, countryCode: "DE" } })).rejects.toThrow(
      /PriceRule_region_target/,
    );
  });
});

describe("resolveCart with a buyer's market", () => {
  it("prices a line for the buyer's market, and for nobody else", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    const eu = await createPriceMarket(named("Eurozone", ["DE", "FR"]));
    const rule = await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });
    const config = await getPriceMarketConfig();
    const item = [{ productId: p.id, variantId: null, quantity: 2 }];

    const french = await resolveCart(item, viewerFor("FR", config));
    expect(french.lines[0].unitMoney.amounts.usd).toBe(1100);
    expect(french.lines[0].unitPriceUsd).toBe(1100);
    expect(french.subtotalUsd).toBe(2200);
    expect(french.lines[0].marketRuleId).toBe(rule.id);
    expect(french.lines[0].marketRuleLabel).toBe("Eurozone +10%");

    const american = await resolveCart(item, viewerFor("US", config));
    expect(american.lines[0].unitMoney.amounts.usd).toBe(1000);
    expect(american.lines[0].marketRuleId).toBeNull();
  });

  it("a country rule beats its market's rule, and a variant rule beats both for that variant", async () => {
    await defaultMarket();
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000, stock: null });
    const v = await createVariant({ productId: p.id, price: 2000 });
    const eu = await createPriceMarket(named("Eurozone", ["DE", "FR"]));
    await createRule({ organizationId: org.id, productId: p.id, userId: "u", write: marketRule({ marketId: eu.id }) });
    await createRule({
      organizationId: org.id,
      productId: p.id,
      userId: "u",
      write: marketRule({ name: "Germany -5%", countryCode: "DE", percentBps: -500 }),
    });
    await createRule({
      organizationId: org.id,
      productId: p.id,
      userId: "u",
      write: marketRule({
        name: "Variant fixed",
        variantId: v.id,
        marketId: eu.id,
        adjustment: "FIXED_PRICE",
        percentBps: null,
        amountMoney: authorMoney(1500, "usd", { usd: 1 }),
      }),
    });
    const config = await getPriceMarketConfig();

    const german = await resolveCart(
      [
        { productId: p.id, variantId: null, quantity: 1 },
        { productId: p.id, variantId: v.id, quantity: 1 },
      ],
      viewerFor("DE", config),
    );
    expect(german.lines[0].marketRuleLabel).toBe("Germany -5%");
    expect(german.lines[0].unitMoney.amounts.usd).toBe(950);
    expect(german.lines[1].marketRuleLabel).toBe("Variant fixed");
    expect(german.lines[1].unitMoney.amounts.usd).toBe(1500);
  });
});

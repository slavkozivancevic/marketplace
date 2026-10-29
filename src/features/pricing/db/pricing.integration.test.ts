import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createOrganization,
  createProduct,
  createUser,
  createVariant,
} from "../../../../test/integration/helpers";
import { moneyCol } from "@/core/db/moneyColumns";
import { authorMoney } from "@/lib/money";

// The horizon route is behind the shared internal key, which the test env does
// not carry. Everything else about the environment stays real.
const INTERNAL_KEY = "test-internal-key";
vi.mock("@/env/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env/server")>();
  return { ...actual, env: { ...actual.env, NOTIFICATIONS_API_KEY: INTERNAL_KEY } };
});
vi.mock("@/features/products/db/cache", () => ({
  revalidateProductCache: vi.fn(),
  revalidateProductCacheFromRoute: vi.fn(),
}));
vi.mock("@/features/orders/db/cache", () => ({ revalidateOrderCache: vi.fn() }));
vi.mock("@/features/audit/db/audit", () => ({ recordAudit: vi.fn() }));
// Order code imports these; nothing here charges a card or sends a message.
vi.mock("@/services/stripe", () => ({ stripe: {} }));
vi.mock("@/services/notifications", () => ({}));

const { ensurePricesCurrent, rollDue } = await import("./roll");
const { regenerateProductWindows } = await import("./windows");
const { getPublicProductsPage } = await import("@/features/products/db/publicProducts");
const { resolveCart } = await import("@/features/cart/db/resolveCart");
const { createCodOrder } = await import("@/features/orders/db/orders");
const { POST: extendPriceWindows } = await import(
  "@/app/api/internal/extend-price-windows/route"
);
const { revalidateProductCacheFromRoute } = await import("@/features/products/db/cache");
const { NextRequest } = await import("next/server");

/** A buyer with no known country and no market rules anywhere: the neutral price. */
const NO_COUNTRY = { country: null, marketId: null, countryMovedAt: null };

const HOUR = 3_600_000;
const usd = (cents: number) => moneyCol(authorMoney(cents, "usd", { usd: 1 }));

beforeEach(async () => {
  await resetDb();
});

/** A one-off percent rule running from an hour ago to an hour from now. */
async function activeRule(input: {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  percentBps?: number;
  startsAt?: Date;
  endsAt?: Date;
}) {
  const now = Date.now();
  return prisma.priceRule.create({
    data: {
      organizationId: input.organizationId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      kind: "SCHEDULE",
      name: "Flash sale",
      adjustment: "PERCENT",
      percentBps: input.percentBps ?? -5000,
      startsAt: input.startsAt ?? new Date(now - HOUR),
      endsAt: input.endsAt ?? new Date(now + HOUR),
      timezone: "Europe/Belgrade",
      recurrence: "NONE",
      weekdays: [],
    },
  });
}

async function applyRules(productId: string) {
  await regenerateProductWindows(prisma, productId);
  await ensurePricesCurrent();
}

const openPoints = (productId: string, variantId: string | null = null) =>
  prisma.pricePoint.findMany({ where: { productId, variantId, endedAt: null } });

describe("base price triggers", () => {
  it("start a new product at its base price with one open ledger point", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1234 });

    expect(p.effectivePrice).toBe(1234);
    expect(p.effectiveUntil).toBeNull();
    expect(await openPoints(p.id)).toHaveLength(1);
  });

  it("copy a base edit straight across when the product has no windows", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    const { mirror, json } = usd(1500);

    const after = await prisma.product.update({
      where: { id: p.id },
      data: { price: mirror, priceMoney: json },
    });

    expect(after.effectivePrice).toBe(1500);
    expect(after.effectiveUntil).toBeNull();
    const points = await prisma.pricePoint.findMany({ where: { productId: p.id } });
    expect(points.map((x) => [x.price, x.endedAt === null])).toEqual(
      expect.arrayContaining([
        [1000, false],
        [1500, true],
      ]),
    );
  });

  it("leave stock updates alone", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000, stock: 5 });
    await prisma.product.update({ where: { id: p.id }, data: { stock: 4 } });
    expect(await prisma.pricePoint.count({ where: { productId: p.id } })).toBe(1);
  });

  it("mark the row due instead when a window exists, and the next read re-prices it", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await activeRule({ organizationId: org.id, productId: p.id });
    await applyRules(p.id);

    const { mirror, json } = usd(2000);
    const marked = await prisma.product.update({
      where: { id: p.id },
      data: { price: mirror, priceMoney: json },
    });
    expect(marked.effectivePrice).toBe(500);
    // The trigger stamps the database's clock, so compare against that one.
    const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
    expect(marked.effectiveUntil!.getTime()).toBeLessThanOrEqual(now.getTime());

    await ensurePricesCurrent();
    const rolled = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(rolled.effectivePrice).toBe(1000);
  });

  it("cover variants too", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, stock: null });
    const v = await createVariant({ productId: p.id, price: 777 });
    expect(v.effectivePrice).toBe(777);
    expect(await openPoints(p.id, v.id)).toHaveLength(1);
  });
});

describe("rolling", () => {
  it("applies an active rule, names it, and strikes through the price before it", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    const r = await activeRule({ organizationId: org.id, productId: p.id });
    await applyRules(p.id);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.effectivePrice).toBe(500);
    expect(row.effectiveRuleId).toBe(r.id);
    expect(row.effectiveRuleLabel).toBe("Flash sale");
    expect(row.effectiveCompareAtPrice).toBe(1000);
    expect(row.effectiveUntil?.getTime()).toBe(r.endsAt!.getTime());
  });

  it("returns to the base price once the window has ended", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await activeRule({ organizationId: org.id, productId: p.id });
    await applyRules(p.id);

    // Move the window into the past, as time passing would.
    await prisma.priceWindow.updateMany({
      where: { productId: p.id },
      data: { startsAt: new Date(Date.now() - 3 * HOUR), endsAt: new Date(Date.now() - HOUR) },
    });
    await prisma.product.update({ where: { id: p.id }, data: { effectiveUntil: new Date(Date.now() - 1000) } });
    await ensurePricesCurrent();

    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.effectivePrice).toBe(1000);
    expect(row.effectiveRuleId).toBeNull();
  });

  it("is idempotent: a second pass changes nothing and writes no ledger point", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await activeRule({ organizationId: org.id, productId: p.id });
    await applyRules(p.id);

    const before = await prisma.pricePoint.count();
    await ensurePricesCurrent();
    await ensurePricesCurrent();
    expect(await prisma.pricePoint.count()).toBe(before);
  });

  it("writes a row and its ledger point once when two readers roll it at the same time", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await activeRule({ organizationId: org.id, productId: p.id });
    await regenerateProductWindows(prisma, p.id);

    const now = new Date();
    const [a, b] = await Promise.all([rollDue(now), rollDue(now)]);
    expect(a.rolled + b.rolled).toBe(1);
    expect(await openPoints(p.id)).toHaveLength(1);
  });

  it("lets a variant rule beat the product rule for that variant only", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, stock: null });
    const v1 = await createVariant({ productId: p.id, price: 2000 });
    const v2 = await createVariant({ productId: p.id, price: 2000 });
    await activeRule({ organizationId: org.id, productId: p.id, percentBps: -1000 });
    await activeRule({ organizationId: org.id, productId: p.id, variantId: v1.id, percentBps: -5000 });
    await applyRules(p.id);

    const [r1, r2] = await Promise.all([
      prisma.productVariant.findUniqueOrThrow({ where: { id: v1.id } }),
      prisma.productVariant.findUniqueOrThrow({ where: { id: v2.id } }),
    ]);
    expect(r1.effectivePrice).toBe(1000);
    expect(r2.effectivePrice).toBe(1800);
  });
});

describe("regenerateProductWindows", () => {
  it("is idempotent", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id });
    await activeRule({ organizationId: org.id, productId: p.id });

    const shape = async () =>
      (await prisma.priceWindow.findMany({ where: { productId: p.id }, orderBy: { startsAt: "asc" } })).map(
        (w) => [w.variantId, w.ruleId, w.startsAt.getTime(), w.endsAt.getTime()],
      );
    const now = new Date();
    await regenerateProductWindows(prisma, p.id, now);
    const first = await shape();
    await regenerateProductWindows(prisma, p.id, now);
    expect(await shape()).toEqual(first);
    expect(first).toHaveLength(1);
  });
});

describe("storefront list", () => {
  it("sorts, filters and flags 'on sale' by the effective price", async () => {
    const org = await createOrganization();
    const cheap = await createProduct({ organizationId: org.id, price: 1000 });
    const promo = await createProduct({ organizationId: org.id, price: 1200 });
    await activeRule({ organizationId: org.id, productId: promo.id });
    await regenerateProductWindows(prisma, promo.id);

    // No explicit roll: the list query must do it itself.
    const asc = await getPublicProductsPage({ take: 10, sortBy: "price", sortOrder: "asc" });
    expect(asc.items.map((i) => [i.id, i.price])).toEqual([
      [promo.id, 600],
      [cheap.id, 1000],
    ]);

    const under = await getPublicProductsPage({ take: 10, maxPrice: 700 });
    expect(under.items.map((i) => i.id)).toEqual([promo.id]);

    const sale = await getPublicProductsPage({ take: 10, onSale: true });
    expect(sale.items.map((i) => [i.id, i.compareAtPrice])).toEqual([[promo.id, 1200]]);

    // The read model never leaks into the payload.
    expect(Object.keys(asc.items[0]).some((k) => k.startsWith("effective"))).toBe(false);
  });
});

describe("cart and checkout", () => {
  it("resolves the effective price and the rule behind it", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    const r = await activeRule({ organizationId: org.id, productId: p.id });
    await regenerateProductWindows(prisma, p.id);

    const res = await resolveCart([{ productId: p.id, variantId: null, quantity: 2 }], NO_COUNTRY);
    expect(res.subtotalUsd).toBe(1000);
    expect(res.lines[0].unitMoney.amounts.usd).toBe(500);
    expect(res.lines[0].priceRuleId).toBe(r.id);
    expect(res.lines[0].priceRuleLabel).toBe("Flash sale");
    expect(res.lines[0].marketRuleId).toBeNull();
  });

  it("stores the charged price and the rule on a COD order line", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const p = await createProduct({ organizationId: org.id, price: 1000 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 500,
      currency: "usd",
      exchangeRate: 1,
      items: [
        {
          productId: p.id,
          variantId: null,
          quantity: 1,
          unitPrice: 500,
          priceRuleId: "rule-1",
          priceRuleLabel: "Flash sale",
        },
      ],
      shipping: {
        name: "Test Buyer",
        line1: "Ulica Primera 12",
        line2: null,
        city: "Demograd",
        state: null,
        postalCode: "00000",
        country: "RS",
      },
    });

    const [line] = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect([line.price, line.priceRuleId, line.priceRuleLabel]).toEqual([500, "rule-1", "Flash sale"]);
  });
});

describe("POST /api/internal/extend-price-windows", () => {
  const call = (key = INTERNAL_KEY) =>
    extendPriceWindows(
      new NextRequest("http://localhost/api/internal/extend-price-windows", {
        method: "POST",
        headers: { "x-api-key": key },
      }),
    );

  it("refuses a wrong key", async () => {
    expect((await call("nope")).status).toBe(401);
  });

  it("rebuilds windows, prunes old ones, and invalidates through the route variant", async () => {
    const org = await createOrganization();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await activeRule({ organizationId: org.id, productId: p.id });
    await prisma.priceWindow.create({
      data: {
        productId: p.id,
        ruleId: "gone",
        startsAt: new Date(Date.now() - 10 * HOUR),
        endsAt: new Date(Date.now() - 9 * HOUR),
      },
    });

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products).toBe(1);
    expect(await prisma.priceWindow.count({ where: { ruleId: "gone" } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).effectivePrice).toBe(500);
    expect(revalidateProductCacheFromRoute).toHaveBeenCalledWith(org.id, p.id);
  });
});

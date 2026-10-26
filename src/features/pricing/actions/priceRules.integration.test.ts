import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createOrganization,
  createProduct,
  createUser,
  createVariant,
} from "../../../../test/integration/helpers";
import { authorMoney } from "@/lib/money";
import type { RequestContext } from "@/types/types";
import type { PriceRuleInput } from "../schema/priceRules";

// The request context is what the app derives from Clerk + the DB; each test
// sets the one it needs. Permission checks stay REAL.
let ctx: RequestContext;
vi.mock("@/lib/auth/resolveRequestContext", () => ({ resolveRequestContext: vi.fn(async () => ctx) }));
vi.mock("@/features/products/db/cache", () => ({
  revalidateProductCache: vi.fn(),
  revalidateProductCacheFromRoute: vi.fn(),
  revalidateProductHistoryCache: vi.fn(),
}));
vi.mock("@/features/audit/db/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/features/currency/db/currencyRates", () => ({ getCurrencyRates: vi.fn(async () => ({ usd: 1 })) }));
vi.mock("@/services/stripe", () => ({ stripe: {} }));
vi.mock("@/services/notifications", () => ({}));
// Error messages come back as their keys, which is what the assertions read.
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/i18n/serverZodErrorMap", () => ({ getServerZodErrorMap: async () => undefined }));

const { createPriceRule, updatePriceRule, deletePriceRule } = await import("./priceRules");
const { createRule } = await import("../db/priceRules");
const { ensurePricesCurrent } = await import("../db/roll");
const { productRepository } = await import("@/features/products/db/products");
const { recordAudit } = await import("@/features/audit/db/audit");

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** A one-off 50% off rule running from an hour ago to a day from now, in UTC. */
function input(overrides: Partial<PriceRuleInput> = {}): PriceRuleInput {
  const start = new Date(Date.now() - HOUR);
  const end = new Date(Date.now() + 24 * HOUR);
  const day = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return {
    kind: "SCHEDULE",
    regionScope: "MARKET",
    marketId: null,
    countryCode: null,
    name: "Flash sale",
    variantId: null,
    adjustment: "PERCENT",
    percentBps: -5000,
    amount: { currency: "usd", amount: 0 },
    priority: 0,
    active: true,
    timezone: "UTC",
    recurrence: "NONE",
    startDate: day(start),
    startTime: time(start),
    endDate: day(end),
    endTime: time(end),
    durationMinutes: null,
    weekdays: [],
    monthDay: null,
    ...overrides,
  };
}

async function seller(options: { verified?: boolean; role?: "OWNER" | "ADMIN" | "MEMBER"; platformAdmin?: boolean } = {}) {
  const org = await createOrganization({ verified: options.verified ?? true });
  const user = await createUser();
  ctx = {
    clerkUserId: user.clerkUserId,
    userId: user.id,
    userRole: options.platformAdmin ? "ADMIN" : "USER",
    organizationId: org.id,
    membershipRole: options.role ?? "OWNER",
    organizationVerified: options.verified ?? true,
  };
  return { org, user };
}

const effective = async (productId: string) => {
  await ensurePricesCurrent();
  return (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).effectivePrice;
};

beforeEach(async () => {
  await resetDb();
  vi.mocked(recordAudit).mockClear();
});

describe("createPriceRule", () => {
  it("stores the rule, builds its windows and changes the effective price", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id, price: 1000 });

    const res = await createPriceRule(p.id, input(), "/dashboard/my-products/x/pricing");
    expect(res).toEqual({ ok: true, redirectTo: "/dashboard/my-products/x/pricing" });

    const [rule] = await prisma.priceRule.findMany({ where: { productId: p.id } });
    expect([rule.kind, rule.percentBps, rule.createdById]).toEqual(["SCHEDULE", -5000, ctx.userId]);
    expect(await prisma.priceWindow.count({ where: { productId: p.id } })).toBe(1);
    expect(await effective(p.id)).toBe(500);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "priceRule.created", entityId: rule.id }),
    );
  });

  it("stores a fixed price as a MoneySet with its USD mirror", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await createPriceRule(
      p.id,
      input({ adjustment: "FIXED_PRICE", amount: { currency: "usd", amount: 799 } }),
      "/x",
    );
    const [rule] = await prisma.priceRule.findMany({ where: { productId: p.id } });
    expect(rule.amount).toBe(799);
    expect(rule.percentBps).toBeNull();
    expect(await effective(p.id)).toBe(799);
  });

  it("refuses a 21st rule in the db layer, even without the form", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id });
    for (let i = 0; i < 20; i++) expect("ok" in (await createPriceRule(p.id, input({ name: `R${i}` }), "/x"))).toBe(true);

    const res = await createPriceRule(p.id, input({ name: "R20" }), "/x");
    expect("error" in res).toBe(true);
    await expect(
      createRule({
        organizationId: org.id,
        productId: p.id,
        userId: ctx.userId,
        write: {
          kind: "SCHEDULE",
          marketId: null,
          countryCode: null,
          name: "direct",
          variantId: null,
          adjustment: "PERCENT",
          percentBps: -100,
          priority: 0,
          active: true,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + HOUR * 2),
          timezone: "UTC",
          recurrence: "NONE",
          startMinute: null,
          durationMinutes: null,
          weekdays: [],
          monthDay: null,
          amountMoney: null,
        },
      }),
    ).rejects.toMatchObject({ name: "LimitReachedError" });
    expect(await prisma.priceRule.count({ where: { productId: p.id } })).toBe(20);
  });

  it("refuses a variant of another product", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id });
    const other = await createProduct({ organizationId: org.id, stock: null });
    const v = await createVariant({ productId: other.id });
    const res = await createPriceRule(p.id, input({ variantId: v.id }), "/x");
    expect("error" in res).toBe(true);
    expect(await prisma.priceRule.count()).toBe(0);
  });

  it("does not find another org's product", async () => {
    await seller();
    const otherOrg = await createOrganization();
    const p = await createProduct({ organizationId: otherOrg.id });
    const res = await createPriceRule(p.id, input(), "/x");
    expect("error" in res).toBe(true);
    expect(await prisma.priceRule.count()).toBe(0);
  });

  it("forbids a MEMBER and an unverified org, allows a platform admin in the active org", async () => {
    const member = await seller({ role: "MEMBER" });
    const p1 = await createProduct({ organizationId: member.org.id });
    expect("error" in (await createPriceRule(p1.id, input(), "/x"))).toBe(true);

    const unverified = await seller({ verified: false });
    const p2 = await createProduct({ organizationId: unverified.org.id });
    expect("error" in (await createPriceRule(p2.id, input(), "/x"))).toBe(true);

    const admin = await seller({ verified: false, role: "MEMBER", platformAdmin: true });
    const p3 = await createProduct({ organizationId: admin.org.id });
    expect("ok" in (await createPriceRule(p3.id, input(), "/x"))).toBe(true);

    expect(await prisma.priceRule.count()).toBe(1);
  });

  it("rejects invalid input before touching the database", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id });
    const res = await createPriceRule(p.id, input({ percentBps: 0 }), "/x");
    expect("error" in res).toBe(true);
    expect(await prisma.priceRule.count()).toBe(0);
  });
});

describe("updatePriceRule / deletePriceRule", () => {
  it("re-prices on update and returns to the base price on delete", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id, price: 1000 });
    await createPriceRule(p.id, input(), "/x");
    const [rule] = await prisma.priceRule.findMany();

    expect("ok" in (await updatePriceRule(rule.id, input({ percentBps: -2500 }), "/x"))).toBe(true);
    expect(await effective(p.id)).toBe(750);

    expect(await deletePriceRule(rule.id)).toEqual({ ok: true });
    expect(await prisma.priceWindow.count({ where: { productId: p.id } })).toBe(0);
    expect(await effective(p.id)).toBe(1000);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "priceRule.deleted" }));
  });

  it("cannot touch another org's rule", async () => {
    const owner = await seller();
    const p = await createProduct({ organizationId: owner.org.id });
    await createPriceRule(p.id, input(), "/x");
    const [rule] = await prisma.priceRule.findMany();

    await seller();
    expect("error" in (await deletePriceRule(rule.id))).toBe(true);
    expect(await prisma.priceRule.count()).toBe(1);
  });
});

describe("variant removal through the product update", () => {
  const usd = (cents: number) => authorMoney(cents, "usd", { usd: 1 });

  it("deletes that variant's rules with an audit row and no FK error, and covers new variants", async () => {
    const { org } = await seller();
    const p = await createProduct({ organizationId: org.id, stock: null, price: 1000 });
    const keep = await createVariant({ productId: p.id, sku: "KEEP", price: 1000 });
    const drop = await createVariant({ productId: p.id, sku: "DROP", price: 1000 });
    await createPriceRule(p.id, input({ name: "Whole product", percentBps: -1000 }), "/x");
    await createPriceRule(p.id, input({ name: "Drop only", variantId: drop.id }), "/x");
    vi.mocked(recordAudit).mockClear();

    const repo = productRepository({ organizationId: org.id, userId: ctx.userId });
    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    await repo.update(p.id, fresh.version, {
      variants: [
        { sku: "KEEP", price: usd(1000), stock: 5 },
        { sku: "NEW", price: usd(2000), stock: 5 },
      ],
    });

    const rules = await prisma.priceRule.findMany({ where: { productId: p.id } });
    expect(rules.map((r) => r.name)).toEqual(["Whole product"]);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "priceRule.deleted", diff: expect.objectContaining({ reason: "variantRemoved" }) }),
    );

    await ensurePricesCurrent();
    const variants = await prisma.productVariant.findMany({ where: { productId: p.id }, orderBy: { sku: "asc" } });
    expect(variants.map((v) => [v.sku, v.effectivePrice])).toEqual([
      ["KEEP", 900],
      ["NEW", 1800],
    ]);
    expect(variants.find((v) => v.id === keep.id)).toBeDefined();
  });
});

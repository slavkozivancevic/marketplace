import { randomUUID } from "node:crypto";
import { prisma } from "@/core/db/prisma";
import type { CouponType, ProductStatus } from "@/generated/prisma/client";
import { moneyCol, optionalMoneyCol } from "@/core/db/moneyColumns";
import { authorMoney, zeroMoney } from "@/lib/money";

export { prisma };

/**
 * Truncates every application table (keeps the migration history) so each test
 * starts from a clean slate. Call in `beforeEach`.
 */
export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────
// Minimal valid rows for the logic under test. Unique fields use a random
// suffix so fixtures never collide within a test.

/**
 * Fixture money: the USD-cent mirror and its MoneySet, written together the way
 * the application writes them - `Product.priceMoney` and friends are NOT NULL.
 * There is no CurrencyRate row in a fresh test database, so the set is USD-only,
 * which is exactly what a USD-priced product looks like.
 */
const usdSet = (cents: number) => authorMoney(cents, "usd", { usd: 1 });

function priceCols(cents: number) {
  const { mirror, json } = moneyCol(usdSet(cents));
  return { price: mirror, priceMoney: json };
}

export function createUser(overrides: { email?: string; clerkUserId?: string } = {}) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      clerkUserId: overrides.clerkUserId ?? `clerk_${id}`,
      email: overrides.email ?? `user_${id}@test.local`,
    },
  });
}

export function createOrganization(overrides: { name?: string; verified?: boolean } = {}) {
  return prisma.organization.create({
    data: {
      name: overrides.name ?? `Org ${randomUUID().slice(0, 8)}`,
      verified: overrides.verified ?? true,
      shippingFlatRateMoney: moneyCol(zeroMoney()).json,
    },
  });
}

export function createProduct(input: {
  organizationId: string;
  price?: number;
  stock?: number | null;
  status?: ProductStatus;
}) {
  return prisma.product.create({
    data: {
      organizationId: input.organizationId,
      ...priceCols(input.price ?? 1000),
      stock: input.stock ?? 10,
      status: input.status ?? "PUBLISHED",
    },
  });
}

export function createVariant(input: {
  productId: string;
  price?: number;
  stock?: number;
  sku?: string;
}) {
  return prisma.productVariant.create({
    data: {
      productId: input.productId,
      sku: input.sku ?? `SKU-${randomUUID().slice(0, 8)}`,
      ...priceCols(input.price ?? 1000),
      stock: input.stock ?? 10,
    },
  });
}

export function createConnectedAccount(input: {
  organizationId: string;
  stripeAccountId?: string;
  payoutsEnabled?: boolean;
}) {
  return prisma.connectedAccount.create({
    data: {
      organizationId: input.organizationId,
      // `acct_mock_` prefix makes isMockAccount() true, so releaseSellerPayout
      // skips the real Stripe transfer call.
      stripeAccountId: input.stripeAccountId ?? `acct_mock_${randomUUID().slice(0, 8)}`,
      payoutsEnabled: input.payoutsEnabled ?? true,
      chargesEnabled: true,
      detailsSubmitted: true,
    },
  });
}

export function createCoupon(input: {
  code?: string;
  type?: CouponType;
  value: number;
  minOrder?: number | null;
  usageLimit?: number | null;
  usageCount?: number;
  expiresAt?: Date | null;
  active?: boolean;
}) {
  const type = input.type ?? "PERCENT";
  // A FIXED coupon's value is money and carries a set; a PERCENT one's value is
  // a percentage and deliberately has none. A minimum is always money.
  const value = optionalMoneyCol(type === "FIXED" ? usdSet(input.value) : null);
  const minOrder = optionalMoneyCol(input.minOrder != null ? usdSet(input.minOrder) : null);
  return prisma.coupon.create({
    data: {
      code: (input.code ?? `TEST${randomUUID().slice(0, 6)}`).toUpperCase(),
      type,
      value: value.mirror ?? input.value,
      valueMoney: value.json,
      minOrder: minOrder.mirror,
      minOrderMoney: minOrder.json,
      usageLimit: input.usageLimit ?? null,
      usageCount: input.usageCount ?? 0,
      expiresAt: input.expiresAt ?? null,
      active: input.active ?? true,
    },
  });
}

import { randomUUID } from "node:crypto";
import { prisma } from "@/core/db/prisma";
import type { CouponType, ProductStatus } from "@/generated/prisma/client";

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
      price: input.price ?? 1000,
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
      price: input.price ?? 1000,
      stock: input.stock ?? 10,
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
  return prisma.coupon.create({
    data: {
      code: (input.code ?? `TEST${randomUUID().slice(0, 6)}`).toUpperCase(),
      type: input.type ?? "PERCENT",
      value: input.value,
      minOrder: input.minOrder ?? null,
      usageLimit: input.usageLimit ?? null,
      usageCount: input.usageCount ?? 0,
      expiresAt: input.expiresAt ?? null,
      active: input.active ?? true,
    },
  });
}

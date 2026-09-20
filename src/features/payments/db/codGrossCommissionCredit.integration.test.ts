import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

/**
 * The one-off correction in
 * `prisma/migrations/20260921094500_cod_gross_commission_credit`.
 *
 * It moves real money - it hands sellers back a coupon share they were charged
 * as commission before the per-part rule existed - and a migration runs once,
 * unattended, against rows nobody will read again. So the shipped file itself is
 * executed here against rows seeded to look like the old world, rather than a
 * second copy of its arithmetic that could agree with itself while the SQL that
 * actually runs does something else.
 */
const MIGRATION = join(
  process.cwd(),
  "prisma/migrations/20260921094500_cod_gross_commission_credit/migration.sql",
);

/**
 * Statement by statement, on ONE connection: the file builds a temp table and
 * then reads it twice, and a temp table belongs to the session that made it -
 * handed to the pool a statement at a time, the second statement would not find
 * it. `prisma migrate` runs the file in a single session for the same reason.
 */
async function runMigration() {
  const statements = readFileSync(MIGRATION, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    for (const statement of statements) {
      await tx.$executeRawUnsafe(statement);
    }
  });
}

beforeEach(async () => {
  await resetDb();
});

/** A settled COD part with its FEE row written by hand, as the old rule left it. */
async function settledCodPart({
  itemsSubtotal,
  discountShare,
  feeBooked,
  refundedGross = 0,
  organizationId,
  settled = true,
}: {
  itemsSubtotal: number;
  discountShare: number;
  feeBooked: number;
  refundedGross?: number;
  organizationId: string;
  settled?: boolean;
}) {
  const user = await createUser();
  const product = await createProduct({ organizationId, price: itemsSubtotal });
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: "COMPLETED",
      paymentMethod: "COD",
      paymentStatus: "PAID",
      fulfillmentStatus: "DELIVERED",
      total: itemsSubtotal - discountShare,
      discountAmount: discountShare,
      shippingTotal: 0,
      currency: "rsd",
      items: {
        create: [{ productId: product.id, quantity: 1, price: itemsSubtotal }],
      },
      sellerParts: {
        create: [
          {
            organizationId,
            itemsSubtotal,
            shippingAmount: 0,
            discountShare,
            status: "DELIVERED",
            shippedAt: new Date(),
            deliveredAt: new Date(),
            codSettledAt: settled ? new Date() : null,
          },
        ],
      },
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      orderId: order.id,
      organizationId,
      type: "FEE",
      status: "SUCCEEDED",
      provider: "COD",
      amount: feeBooked,
      currency: "rsd",
    },
  });

  if (refundedGross > 0) {
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "COD",
        providerId: `re_${randomUUID()}`,
        amount: refundedGross,
        currency: "rsd",
      },
    });
  }

  return order;
}

const balanceOf = async (organizationId: string) =>
  (await prisma.orgBalance.findFirst({ where: { organizationId } }))?.owedAmount ?? 0;

describe("the COD gross-commission correction", () => {
  it("credits the whole coupon share when nothing was returned", async () => {
    const org = await createOrganization();
    // Goods 1000, commission booked at the gross 100, coupon share 300.
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
    });

    await runMigration();

    expect(await balanceOf(org.id)).toBe(-300);
  });

  it("credits only the remainder when some goods already went back", async () => {
    const org = await createOrganization();
    // Half the goods returned: the old rule reversed the gross fee on them,
    // handing back 150 of coupon it should not have, so 150 is left to give.
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      refundedGross: 500,
    });

    await runMigration();

    expect(await balanceOf(org.id)).toBe(-150);
  });

  it("leaves a fully returned part alone - its books already close at zero", async () => {
    const org = await createOrganization();
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      refundedGross: 1000,
    });

    await runMigration();

    expect(await balanceOf(org.id)).toBe(0);
    expect(await prisma.paymentTransaction.count({ where: { amount: { lt: 0 } } })).toBe(0);
  });

  it("does not touch a part settled under the current rule", async () => {
    const org = await createOrganization();
    // The netted accrual: 100 of commission less a 300 coupon share is -200.
    // Nothing marks it as old, and nothing may be credited to it twice.
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: -200,
    });

    await runMigration();

    expect(await balanceOf(org.id)).toBe(0);
  });

  it("ignores an order with no coupon at all", async () => {
    const org = await createOrganization();
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 0,
      feeBooked: 100,
    });

    await runMigration();

    expect(await balanceOf(org.id)).toBe(0);
  });

  it("ignores a part whose cash was never collected", async () => {
    const org = await createOrganization();
    // No commission was ever accrued for it, so there is nothing to hand back.
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      settled: false,
    });

    await runMigration();

    expect(await balanceOf(org.id)).toBe(0);
  });

  it("says so in the ledger, rather than moving the balance silently", async () => {
    const org = await createOrganization();
    const order = await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
    });

    await runMigration();

    const credit = await prisma.paymentTransaction.findFirstOrThrow({
      where: { orderId: order.id, type: "FEE", amount: { lt: 0 } },
    });
    expect(credit.amount).toBe(-300);
    expect(credit.organizationId).toBe(org.id);
    expect(credit.currency).toBe("rsd");
    expect(credit.note).toContain("coupon share");
  });

  it("adds up across several orders of the same seller", async () => {
    const org = await createOrganization();
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
    });
    await settledCodPart({
      organizationId: org.id,
      itemsSubtotal: 2000,
      discountShare: 400,
      feeBooked: 200,
      refundedGross: 1000,
    });

    await runMigration();

    // 300 from the first, and 400 - 200 from the half-returned second.
    expect(await balanceOf(org.id)).toBe(-500);
  });
});

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
 * `20260921130000_cod_settled_from_fee_row`, run after the correction it
 * repairs.
 *
 * The first correction keyed on `codSettledAt`, which `order_seller_part` had
 * backfilled from the ORDER's payment axis - true only while nothing had been
 * given back. A COD order collected and then partly returned sits at
 * PARTIALLY_REFUNDED, so its part claimed the cash never came in and the credit
 * passed it by. Both migrations are executed here, in the order they ship in,
 * against rows seeded in exactly that shape.
 */
const MIGRATIONS = [
  "20260921094500_cod_gross_commission_credit",
  "20260921130000_cod_settled_from_fee_row",
].map((name) => join(process.cwd(), "prisma/migrations", name, "migration.sql"));

/** One session per file - they build temp tables and read them back. */
async function runMigrations(files: string[] = MIGRATIONS) {
  for (const file of files) {
    const statements = readFileSync(file, "utf8")
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
}

beforeEach(async () => {
  await resetDb();
});

/** A COD part with its FEE row, as the old rule and the first backfill left it. */
async function codPart({
  organizationId,
  itemsSubtotal,
  discountShare,
  feeBooked,
  refundedGross = 0,
  paymentStatus,
  codSettledAt,
  cancelledAt = null,
}: {
  organizationId: string;
  itemsSubtotal: number;
  discountShare: number;
  feeBooked: number | null;
  refundedGross?: number;
  paymentStatus: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "UNPAID";
  codSettledAt: Date | null;
  cancelledAt?: Date | null;
}) {
  const user = await createUser();
  const product = await createProduct({ organizationId, price: itemsSubtotal });
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: "COMPLETED",
      paymentMethod: "COD",
      paymentStatus,
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
            status: cancelledAt ? "CANCELLED" : "DELIVERED",
            shippedAt: new Date(),
            deliveredAt: new Date(),
            codSettledAt,
            cancelledAt,
          },
        ],
      },
    },
  });

  if (feeBooked !== null) {
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
  }

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

const partOf = (orderId: string) =>
  prisma.orderSellerPart.findFirstOrThrow({ where: { orderId } });

const balanceOf = async (organizationId: string) =>
  (await prisma.orgBalance.findFirst({ where: { organizationId } }))?.owedAmount ?? 0;

const correctionsOn = (orderId: string) =>
  prisma.paymentTransaction.count({
    where: { orderId, type: "FEE", note: { startsWith: "Correction:" } },
  });

describe("the COD settlement repair", () => {
  it("marks a part whose cash was confirmed before the order was partly returned", async () => {
    const org = await createOrganization();
    const settledAt = new Date("2026-06-01T10:00:00Z");
    const order = await codPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      refundedGross: 500,
      paymentStatus: "PARTIALLY_REFUNDED",
      codSettledAt: null,
    });
    // The FEE row is the moment the seller confirmed its cash.
    await prisma.paymentTransaction.updateMany({
      where: { orderId: order.id, type: "FEE" },
      data: { createdAt: settledAt },
    });

    await runMigrations();

    expect((await partOf(order.id)).codSettledAt).toEqual(settledAt);
  });

  it("pays that part the credit the first correction had skipped", async () => {
    const org = await createOrganization();
    const order = await codPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      refundedGross: 500,
      paymentStatus: "PARTIALLY_REFUNDED",
      codSettledAt: null,
    });

    await runMigrations();

    // Half the goods were already back, so half the coupon share was already
    // handed over by the old gross reversal - 150 is what is left.
    expect(await balanceOf(org.id)).toBe(-150);
    expect(await correctionsOn(order.id)).toBe(1);
  });

  it("does not credit a part the first correction already paid", async () => {
    const org = await createOrganization();
    const order = await codPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      paymentStatus: "PAID",
      codSettledAt: new Date(),
    });

    await runMigrations();

    expect(await correctionsOn(order.id)).toBe(1);
    expect(await balanceOf(org.id)).toBe(-300);
  });

  it("leaves a part with no commission row unsettled - nothing was ever confirmed", async () => {
    const org = await createOrganization();
    const order = await codPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: null,
      paymentStatus: "UNPAID",
      codSettledAt: null,
    });

    await runMigrations();

    expect((await partOf(order.id)).codSettledAt).toBeNull();
    expect(await balanceOf(org.id)).toBe(0);
  });

  it("leaves a withdrawn part alone - it collected nothing to be credited for", async () => {
    const org = await createOrganization();
    const order = await codPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      paymentStatus: "PARTIALLY_REFUNDED",
      codSettledAt: null,
      cancelledAt: new Date(),
    });

    await runMigrations();

    expect((await partOf(order.id)).codSettledAt).toBeNull();
    expect(await correctionsOn(order.id)).toBe(0);
  });

  it("does not mistake its own correction row for a settlement", async () => {
    // The correction writes a FEE row too. Read as the settlement marker it
    // would stamp a part with the moment of the repair instead of the sale.
    const org = await createOrganization();
    const settledAt = new Date("2026-06-01T10:00:00Z");
    const order = await codPart({
      organizationId: org.id,
      itemsSubtotal: 1000,
      discountShare: 300,
      feeBooked: 100,
      refundedGross: 500,
      paymentStatus: "PARTIALLY_REFUNDED",
      codSettledAt: null,
    });
    await prisma.paymentTransaction.updateMany({
      where: { orderId: order.id, type: "FEE" },
      data: { createdAt: settledAt },
    });

    await runMigrations();
    // The repair again, on its own. Not the pair: the first correction has no
    // "already paid" guard and does not need one - a migration runs once, and
    // adding it now would rewrite a file that has already been applied.
    await runMigrations([MIGRATIONS[1]]);

    expect((await partOf(order.id)).codSettledAt).toEqual(settledAt);
    expect(await correctionsOn(order.id)).toBe(1);
  });
});

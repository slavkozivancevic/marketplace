import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createCoupon,
} from "../../../../test/integration/helpers";

/**
 * The seller-part matrix.
 *
 * One order can hold several sellers, each moving through its own lifecycle
 * (pending -> shipped -> delivered -> cash collected, or cancelled at any point
 * before the cash). The order's own axes, its money and its ledger are all
 * derived from those parts, so the combinations are what has to be pinned down -
 * not the happy path.
 *
 * Every expected figure below is worked out by hand in the comment beside it.
 */

vi.mock("@/services/stripe", () => ({
  stripe: {
    transfers: { create: vi.fn().mockResolvedValue({ id: "tr_test" }), createReversal: vi.fn() },
    refunds: { create: vi.fn().mockResolvedValue({ id: "re_test" }) },
  },
}));
vi.mock("@/features/orders/db/cache", () => ({ revalidateOrderCache: vi.fn() }));
vi.mock("@/features/products/db/cache", () => ({
  revalidateProductCache: vi.fn(),
  revalidateProductCacheFromRoute: vi.fn(),
}));
vi.mock("@/features/audit/db/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/notifications", () => ({
  publishCodOrderCancelled: vi.fn(),
  publishCodPaymentReceived: vi.fn(),
  publishCodOrderFulfilled: vi.fn(),
  publishOrderShipped: vi.fn().mockResolvedValue(undefined),
  publishOrderTrackingUpdated: vi.fn().mockResolvedValue(undefined),
  publishOrderDelivered: vi.fn(),
  publishSellerPayoutReleased: vi.fn(),
}));

const { createCodOrder, fulfillOrder } = await import("./orders");
const { syncOrderFromParts } = await import("./sellerParts");
const { createShipment, markShipmentDelivered } = await import(
  "@/features/shipments/db/shipments"
);

const SHIPPING = {
  name: "Test Buyer",
  line1: "Zemunska 15",
  line2: null,
  city: "Dobanovci",
  state: null,
  postalCode: "11272",
  country: "RS",
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

/**
 * Three sellers, deliberately uneven so pro-rata splits and per-seller totals
 * cannot accidentally agree:
 *
 *   A  1 x 1000 = 1000 items, 300 delivery
 *   B  1 x  500 =  500 items, 400 delivery
 *   C  2 x  250 =  500 items, 200 delivery
 *              subtotal 2000, delivery 900
 */
async function threeSellerOrder(opts: { couponId?: string; discountAmount?: number } = {}) {
  const user = await createUser();
  const [orgA, orgB, orgC] = await Promise.all([
    createOrganization(),
    createOrganization(),
    createOrganization(),
  ]);
  const [pA, pB, pC] = await Promise.all([
    createProduct({ organizationId: orgA.id, price: 1000, stock: 100 }),
    createProduct({ organizationId: orgB.id, price: 500, stock: 100 }),
    createProduct({ organizationId: orgC.id, price: 250, stock: 100 }),
  ]);

  const discount = opts.discountAmount ?? 0;
  const order = await createCodOrder({
    userId: user.id,
    totalInCurrency: 2000 - discount + 900,
    currency: "usd",
    exchangeRate: 1,
    items: [
      { productId: pA.id, variantId: null, quantity: 1 },
      { productId: pB.id, variantId: null, quantity: 1 },
      { productId: pC.id, variantId: null, quantity: 2 },
    ],
    shipping: SHIPPING,
    shippingTotal: 900,
    shippingByOrg: { [orgA.id]: 300, [orgB.id]: 400, [orgC.id]: 200 },
    couponId: opts.couponId,
    couponCode: opts.couponId ? "MATRIX" : undefined,
  });

  return { user, orgA, orgB, orgC, pA, pB, pC, order };
}

const part = (orderId: string, organizationId: string) =>
  prisma.orderSellerPart.findUniqueOrThrow({
    where: { orderId_organizationId: { orderId, organizationId } },
  });

const reloadOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

/** Marks a part cancelled through the same path the action uses, then re-derives. */
async function cancelPart(orderId: string, organizationId: string) {
  const p = await part(orderId, organizationId);
  await prisma.orderSellerPart.update({
    where: { id: p.id },
    data: { cancelledAt: new Date(), status: "CANCELLED" },
  });
  return syncOrderFromParts(orderId);
}

async function settlePart(orderId: string, organizationId: string) {
  const p = await part(orderId, organizationId);
  await prisma.orderSellerPart.update({
    where: { id: p.id },
    data: { codSettledAt: new Date() },
  });
  return syncOrderFromParts(orderId);
}

// ─── Creation ────────────────────────────────────────────────────────────────

describe("matrix: order creation", () => {
  it("creates one part per seller, never one per item", async () => {
    const { orgA, orgC, order } = await threeSellerOrder();
    const parts = await prisma.orderSellerPart.findMany({ where: { orderId: order.id } });
    expect(parts).toHaveLength(3);

    // C has two units of one product - still a single part.
    expect((await part(order.id, orgC.id)).itemsSubtotal).toBe(500);
    expect((await part(order.id, orgA.id)).itemsSubtotal).toBe(1000);
  });

  it("snapshots each seller's own delivery, not a share of the total", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    expect((await part(order.id, orgA.id)).shippingAmount).toBe(300);
    expect((await part(order.id, orgB.id)).shippingAmount).toBe(400);
    expect((await part(order.id, orgC.id)).shippingAmount).toBe(200);
  });

  it("starts every part PENDING with no timestamps", async () => {
    const { orgA, order } = await threeSellerOrder();
    const p = await part(order.id, orgA.id);
    expect(p.status).toBe("PENDING");
    expect(p.shippedAt).toBeNull();
    expect(p.deliveredAt).toBeNull();
    expect(p.cancelledAt).toBeNull();
    expect(p.codSettledAt).toBeNull();
  });

  it("splits an indivisible discount so the shares still sum exactly", async () => {
    const coupon = await createCoupon({ value: 5, usageLimit: 10 });
    // 101 over a 2000 subtotal: floors are 50 / 25 / 25 = 100, remainder 1.
    const { orgA, orgB, orgC, order } = await threeSellerOrder({
      couponId: coupon.id,
      discountAmount: 101,
    });

    const [a, b, c] = [
      await part(order.id, orgA.id),
      await part(order.id, orgB.id),
      await part(order.id, orgC.id),
    ];
    // The remainder goes to the largest part, which is A.
    expect(a.discountShare).toBe(51);
    expect(b.discountShare).toBe(25);
    expect(c.discountShare).toBe(25);
    expect(a.discountShare + b.discountShare + c.discountShare).toBe(order.discountAmount);
    expect(order.discountAmount).toBe(101);
  });

  it("agrees with the order it was built from", async () => {
    const coupon = await createCoupon({ value: 5, usageLimit: 10 });
    const { order } = await threeSellerOrder({ couponId: coupon.id, discountAmount: 101 });
    const parts = await prisma.orderSellerPart.findMany({ where: { orderId: order.id } });
    const fromParts = parts.reduce(
      (s, p) => s + p.itemsSubtotal - p.discountShare + p.shippingAmount,
      0,
    );
    // 2000 - 101 + 900
    expect(order.total).toBe(2799);
    expect(fromParts).toBe(order.total);
  });

  it("creates parts for card orders too", async () => {
    const user = await createUser();
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const pA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 10 });
    const pB = await createProduct({ organizationId: orgB.id, price: 500, stock: 10 });

    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${Date.now()}`,
      totalCents: 1500,
      currency: "usd",
      exchangeRate: 1,
      items: [
        { productId: pA.id, variantId: null, quantity: 1 },
        { productId: pB.id, variantId: null, quantity: 1 },
      ],
      shipping: SHIPPING,
    });

    const parts = await prisma.orderSellerPart.findMany({ where: { orderId: order.id } });
    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.status === "PENDING")).toBe(true);
  });
});

// ─── Fulfillment axis across every combination ───────────────────────────────

describe("matrix: goods axis from three parts", () => {
  it("is UNFULFILLED while nobody has shipped", async () => {
    const { order } = await threeSellerOrder();
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("UNFULFILLED");
  });

  it("is PARTIALLY_FULFILLED when one of three has shipped", async () => {
    const { orgA, order } = await threeSellerOrder();
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("PARTIALLY_FULFILLED");
  });

  it("is FULFILLED only once all three have shipped", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    await createShipment({ orderId: order.id, organizationId: orgB.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("PARTIALLY_FULFILLED");
    await createShipment({ orderId: order.id, organizationId: orgC.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("FULFILLED");
  });

  it("is DELIVERED only once all three have delivered", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    for (const org of [orgA, orgB, orgC]) {
      await createShipment({ orderId: order.id, organizationId: org.id });
    }
    await markShipmentDelivered({ orderId: order.id, organizationId: orgA.id });
    await markShipmentDelivered({ orderId: order.id, organizationId: orgB.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("FULFILLED");
    await markShipmentDelivered({ orderId: order.id, organizationId: orgC.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("DELIVERED");
  });

  // The reason cancelled parts must leave the denominator: an order that can
  // never reach DELIVERED is a COD order whose cash can never be collected.
  it("does not wait on a cancelled part to reach FULFILLED", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgC.id);
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    await createShipment({ orderId: order.id, organizationId: orgB.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("FULFILLED");
  });

  it("does not wait on a cancelled part to reach DELIVERED", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgC.id);
    for (const org of [orgA, orgB]) {
      await createShipment({ orderId: order.id, organizationId: org.id });
      await markShipmentDelivered({ orderId: order.id, organizationId: org.id });
    }
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("DELIVERED");
  });

  it("still reports partial progress among the sellers that remain", async () => {
    const { orgA, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgC.id);
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    // A shipped, B has not - one of the two active sellers.
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("PARTIALLY_FULFILLED");
  });

  it("reaches DELIVERED on a single remaining seller", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgB.id);
    await cancelPart(order.id, orgC.id);
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    await markShipmentDelivered({ orderId: order.id, organizationId: orgA.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("DELIVERED");
  });

  // Cancelling everything must not rewrite history back to "nothing shipped".
  it("keeps the goods axis it had reached when the last seller withdraws", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    await createShipment({ orderId: order.id, organizationId: orgB.id });
    await createShipment({ orderId: order.id, organizationId: orgC.id });
    expect((await reloadOrder(order.id)).fulfillmentStatus).toBe("FULFILLED");

    await cancelPart(order.id, orgA.id);
    await cancelPart(order.id, orgB.id);
    const after = await cancelPart(order.id, orgC.id);

    expect(after.orderCancelled).toBe(true);
    const row = await reloadOrder(order.id);
    expect(row.fulfillmentStatus).toBe("FULFILLED");
    expect(row.status).toBe("CANCELLED");
    expect(row.cancelledAt).not.toBeNull();
  });
});

// ─── COD money axis ──────────────────────────────────────────────────────────

describe("matrix: COD payment axis from three parts", () => {
  it("stays UNPAID until the last active seller collects", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await settlePart(order.id, orgA.id);
    expect((await reloadOrder(order.id)).paymentStatus).toBe("UNPAID");
    await settlePart(order.id, orgB.id);
    expect((await reloadOrder(order.id)).paymentStatus).toBe("UNPAID");
    await settlePart(order.id, orgC.id);
    expect((await reloadOrder(order.id)).paymentStatus).toBe("PAID");
  });

  it("counts a cancelled seller as nothing to wait for", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await settlePart(order.id, orgA.id);
    await cancelPart(order.id, orgB.id);
    expect((await reloadOrder(order.id)).paymentStatus).toBe("UNPAID");
    await settlePart(order.id, orgC.id);
    expect((await reloadOrder(order.id)).paymentStatus).toBe("PAID");
  });

  it("is paid the moment the last unsettled seller withdraws", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await settlePart(order.id, orgA.id);
    await cancelPart(order.id, orgB.id);
    const after = await cancelPart(order.id, orgC.id);
    // A is the only active part and it has collected.
    expect(after.paymentStatus).toBe("PAID");
    expect(after.orderCancelled).toBe(false);
  });

  it("never turns a fully cancelled order into a paid one", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgA.id);
    await cancelPart(order.id, orgB.id);
    const after = await cancelPart(order.id, orgC.id);
    expect(after.orderCancelled).toBe(true);
    expect(after.paymentStatus).toBe("UNPAID");
    expect((await reloadOrder(order.id)).status).toBe("CANCELLED");
  });
});

// ─── Derived display status, every stage ─────────────────────────────────────

describe("matrix: the order's display status at each stage", () => {
  it("walks PENDING -> SHIPPED -> DELIVERED -> COMPLETED", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    const orgs = [orgA, orgB, orgC];
    expect((await reloadOrder(order.id)).status).toBe("PENDING");

    for (const org of orgs) await createShipment({ orderId: order.id, organizationId: org.id });
    expect((await reloadOrder(order.id)).status).toBe("SHIPPED");

    for (const org of orgs) {
      await markShipmentDelivered({ orderId: order.id, organizationId: org.id });
    }
    expect((await reloadOrder(order.id)).status).toBe("DELIVERED");

    for (const org of orgs) await settlePart(order.id, org.id);
    expect((await reloadOrder(order.id)).status).toBe("COMPLETED");
  });

  it("shows SHIPPED while only some of the active sellers have shipped", async () => {
    const { orgA, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgC.id);
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    expect((await reloadOrder(order.id)).status).toBe("SHIPPED");
  });
});

// ─── Money as sellers drop out ───────────────────────────────────────────────

describe("matrix: what the order is still worth", () => {
  it("drops each seller's whole share - items, its discount and its delivery", async () => {
    const coupon = await createCoupon({ value: 5, usageLimit: 10 });
    const { orgA, orgB, order } = await threeSellerOrder({
      couponId: coupon.id,
      discountAmount: 101,
    });
    expect(order.total).toBe(2799);

    await cancelPart(order.id, orgA.id);
    // Left: B 500 - 25 + 400, C 500 - 25 + 200 = 875 + 675
    let row = await reloadOrder(order.id);
    expect(row.total).toBe(1550);
    expect(row.discountAmount).toBe(50);
    expect(row.shippingTotal).toBe(600);

    await cancelPart(order.id, orgB.id);
    // Left: C only.
    row = await reloadOrder(order.id);
    expect(row.total).toBe(675);
    expect(row.discountAmount).toBe(25);
    expect(row.shippingTotal).toBe(200);
  });

  // The returns flow rebuilds the refundable gross from these three, so they
  // have to stay consistent with each other at every step.
  it("keeps total + discount - delivery equal to the active goods", async () => {
    const coupon = await createCoupon({ value: 5, usageLimit: 10 });
    const { orgA, orgB, orgC, order } = await threeSellerOrder({
      couponId: coupon.id,
      discountAmount: 101,
    });

    for (const org of [orgA, orgB]) {
      await cancelPart(order.id, org.id);
      const row = await reloadOrder(order.id);
      const active = await prisma.orderSellerPart.findMany({
        where: { orderId: order.id, cancelledAt: null },
      });
      const goods = active.reduce((s, p) => s + p.itemsSubtotal, 0);
      expect(row.total + row.discountAmount - row.shippingTotal).toBe(goods);
    }
    expect((await reloadOrder(order.id)).cancelledAt).toBeNull();
    await cancelPart(order.id, orgC.id);
  });

  it("freezes the figures once no seller is left, as a record of what it was", async () => {
    const { orgA, orgB, orgC, order } = await threeSellerOrder();
    await cancelPart(order.id, orgA.id);
    await cancelPart(order.id, orgB.id);
    const beforeLast = await reloadOrder(order.id);
    // C alone: 500 items + 200 delivery.
    expect(beforeLast.total).toBe(700);

    await cancelPart(order.id, orgC.id);
    const after = await reloadOrder(order.id);
    // Not recomputed to zero - the order is cancelled and collects nothing, so
    // the stored figure stays as the last thing it actually meant.
    expect(after.total).toBe(700);
    expect(after.status).toBe("CANCELLED");
  });
});

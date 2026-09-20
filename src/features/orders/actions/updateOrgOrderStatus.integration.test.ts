import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createVariant,
  createCoupon,
} from "../../../../test/integration/helpers";

// The seller acting right now. Each test sets this before calling an action, so
// one order can be worked on by two different sellers in turn - which is the
// whole point of what is under test here.
const { activeOrgId } = vi.hoisted(() => ({ activeOrgId: { current: "" } }));

vi.mock("@/lib/auth/resolveRequestContext", () => ({
  resolveRequestContext: vi.fn(async () => ({
    organizationId: activeOrgId.current,
    membershipRole: "OWNER",
    userId: "test-user",
    isPlatformAdmin: false,
  })),
}));
vi.mock("@/lib/auth/permissions", () => ({ requirePermission: vi.fn() }));

// payments/db/payouts.ts builds a real Stripe client at import time, and the
// test env has no API key.
vi.mock("@/services/stripe", () => ({
  stripe: { transfers: { create: vi.fn(), createReversal: vi.fn() } },
}));

// Cache invalidation and notifications need a request/Server Action context that
// does not exist in a test process; the ledger and stock assertions below are the
// point, not the fan-out.
vi.mock("@/features/orders/db/cache", () => ({ revalidateOrderCache: vi.fn() }));
vi.mock("@/features/products/db/cache", () => ({
  revalidateProductCache: vi.fn(),
  revalidateProductCacheFromRoute: vi.fn(),
}));
vi.mock("@/features/audit/db/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/notifications", () => ({
  publishCodOrderCancelled: vi.fn(),
  publishCodPaymentReceived: vi.fn(),
}));

const { cancelOrder, markCodPaymentReceived } = await import("./updateOrgOrderStatus");
const { createCodOrder } = await import("../db/orders");
const { validateCoupon } = await import("@/features/coupons/db/coupons");
const { publishCodOrderCancelled } = await import("@/services/notifications");

const SHIPPING = {
  name: "Test Buyer",
  line1: "Zemunska 15",
  line2: null,
  city: "Belgrade",
  state: null,
  postalCode: "11000",
  country: "RS",
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

/** A COD order holding one product from each of two different sellers. */
async function twoSellerCodOrder(opts: { couponId?: string; discountAmount?: number } = {}) {
  const user = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  const productA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 100 });
  const productB = await createProduct({ organizationId: orgB.id, price: 500, stock: 50 });

  // Items 1000 + 500, delivery 300 + 400, less any discount.
  const subtotal = 1500;
  const shippingTotal = 700;
  const discount = opts.discountAmount ?? 0;

  const order = await createCodOrder({
    userId: user.id,
    totalInCurrency: subtotal - discount + shippingTotal,
    currency: "usd",
    exchangeRate: 1,
    items: [
      { productId: productA.id, variantId: null, quantity: 1 },
      { productId: productB.id, variantId: null, quantity: 1 },
    ],
    shipping: SHIPPING,
    shippingTotal,
    shippingByOrg: { [orgA.id]: 300, [orgB.id]: 400 },
    couponId: opts.couponId,
    couponCode: opts.couponId ? "TESTCODE" : undefined,
  });

  return { user, orgA, orgB, productA, productB, order };
}

const partFor = (orderId: string, organizationId: string) =>
  prisma.orderSellerPart.findUniqueOrThrow({
    where: { orderId_organizationId: { orderId, organizationId } },
  });

describe("order creation", () => {
  it("gives the order one seller part per seller, with its own money", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();

    const parts = await prisma.orderSellerPart.findMany({ where: { orderId: order.id } });
    expect(parts).toHaveLength(2);

    const a = await partFor(order.id, orgA.id);
    const b = await partFor(order.id, orgB.id);
    expect(a.itemsSubtotal).toBe(1000);
    expect(a.shippingAmount).toBe(300);
    expect(b.itemsSubtotal).toBe(500);
    expect(b.shippingAmount).toBe(400);
    expect(a.status).toBe("PENDING");
  });

  it("splits an order-level discount across the parts without losing a cent", async () => {
    const coupon = await createCoupon({ value: 10, usageLimit: 5 });
    const { orgA, orgB, order } = await twoSellerCodOrder({
      couponId: coupon.id,
      discountAmount: 150,
    });

    const a = await partFor(order.id, orgA.id);
    const b = await partFor(order.id, orgB.id);
    expect(a.discountShare + b.discountShare).toBe(order.discountAmount);
    // Items are 1000 vs 500, so the split is 2:1.
    expect(a.discountShare).toBe(100);
    expect(b.discountShare).toBe(50);
  });
});

describe("cancelOrder - one seller withdrawing", () => {
  it("restocks only its own items and leaves the other seller's alone", async () => {
    const { orgA, productA, productB, order } = await twoSellerCodOrder();

    activeOrgId.current = orgA.id;
    const result = await cancelOrder(order.id);
    expect(result).toEqual({ success: true });

    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).stock).toBe(100);
    // B sold one and is still selling it - 50 less the one in this order.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productB.id } })).stock).toBe(49);
  });

  it("keeps the order alive for the sellers who are still delivering", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.cancelledAt).toBeNull();
    expect(after.status).not.toBe("CANCELLED");
    // Only B's goods and delivery are still owed: 500 items + 400 delivery.
    expect(after.total).toBe(900);

    expect((await partFor(order.id, orgA.id)).status).toBe("CANCELLED");
    expect((await partFor(order.id, orgB.id)).status).toBe("PENDING");
  });

  it("reduces the pending cash charge so the courier collects the smaller amount", async () => {
    const { orgA, order } = await twoSellerCodOrder();

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    const charge = await prisma.paymentTransaction.findFirstOrThrow({
      where: { orderId: order.id, type: "CHARGE" },
    });
    expect(charge.status).toBe("PENDING");
    expect(charge.amount).toBe(900);
  });

  // total, discountAmount and shippingTotal have to move together. The return
  // flow rebuilds the refundable gross as `total + discount - shipping`, so a
  // total that shrank while the other two still described the whole order would
  // put "fully refunded" permanently out of reach.
  it("keeps the discount and delivery in step with the reduced total", async () => {
    const coupon = await createCoupon({ value: 10, usageLimit: 5 });
    const { orgA, orgB, order } = await twoSellerCodOrder({
      couponId: coupon.id,
      discountAmount: 150,
    });

    const bShare = await partFor(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    // Only B is left: items 500, its 50 discount share, its 400 delivery.
    expect(after.discountAmount).toBe(bShare.discountShare);
    expect(after.shippingTotal).toBe(bShare.shippingAmount);
    expect(after.total).toBe(
      bShare.itemsSubtotal - bShare.discountShare + bShare.shippingAmount,
    );
    // The refundable gross the return flow derives is exactly B's goods.
    expect(after.total + after.discountAmount - after.shippingTotal).toBe(
      bShare.itemsSubtotal,
    );
  });

  it("holds on to the coupon slot while the order still exists", async () => {
    const coupon = await createCoupon({ value: 10, usageLimit: 5 });
    const { orgA, order } = await twoSellerCodOrder({ couponId: coupon.id, discountAmount: 150 });

    const afterCheckout = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(afterCheckout.usageCount).toBe(1);

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    // The order is still live and still used the code - the slot stays spent.
    const afterCancel = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(afterCancel.usageCount).toBe(1);
  });

  // The per-buyer limit is never stored - it counts the buyer's non-cancelled
  // orders live. A partially cancelled order is still one of them, so the code
  // stays spent for that buyer until every seller has withdrawn.
  it("still counts against the buyer's own coupon limit", async () => {
    const coupon = await createCoupon({ value: 10, perUserLimit: 1 });
    const { user, orgA, orgB, order } = await twoSellerCodOrder({
      couponId: coupon.id,
      discountAmount: 150,
    });

    const ctx = { currency: "usd" as const, rates: { usd: 1 }, subtotal: 1500 };
    expect(await validateCoupon(coupon.code, 1500, user.id, ctx)).toMatchObject({
      ok: false,
      reason: "alreadyUsed",
    });

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    expect(await validateCoupon(coupon.code, 1500, user.id, ctx)).toMatchObject({
      ok: false,
      reason: "alreadyUsed",
    });

    // Once the order is gone entirely, the buyer may use the code again.
    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);
    expect((await validateCoupon(coupon.code, 1500, user.id, ctx)).ok).toBe(true);
  });

  it("tells the buyer about each seller's cancellation separately", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    // Both events must get out. They used to share one eventId per order, so the
    // second seller's cancellation looked like a replay and was dropped.
    expect(publishCodOrderCancelled).toHaveBeenCalledTimes(2);
    expect(publishCodOrderCancelled).toHaveBeenCalledWith(order.id, orgA.id, expect.anything());
    expect(publishCodOrderCancelled).toHaveBeenCalledWith(order.id, orgB.id, expect.anything());
  });

  it("refuses to let a seller touch an order it has no part in", async () => {
    const outsider = await createOrganization();
    const { productA, order } = await twoSellerCodOrder();

    activeOrgId.current = outsider.id;
    expect(await cancelOrder(order.id)).toEqual({ error: "Order not found" });

    // Nothing moved.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).stock).toBe(99);
  });

  // An order stays UNPAID until the LAST seller collects, so the order-level
  // guard alone would let a seller that already took its cash withdraw - undoing
  // a completed handover and leaving its commission accrued against nothing.
  it("refuses once this seller has collected its own cash", async () => {
    const { orgA, productA, order } = await twoSellerCodOrder();
    await prisma.orderSellerPart.update({
      where: { orderId_organizationId: { orderId: order.id, organizationId: orgA.id } },
      data: { shippedAt: new Date(), deliveredAt: new Date(), status: "DELIVERED" },
    });

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    // B has not collected, so the order is still UNPAID overall.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "UNPAID",
    );

    expect(await cancelOrder(order.id)).toEqual({
      error: "You have already collected payment for your part",
    });
    // Nothing was put back on the shelf.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).stock).toBe(99);
  });

  it("refuses a second cancellation of the same part", async () => {
    const { orgA, order } = await twoSellerCodOrder();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    expect(await cancelOrder(order.id)).toEqual({
      error: "Your part of this order is already cancelled",
    });
  });
});

describe("cancelOrder - the last seller withdrawing", () => {
  it("cancels the order, fails the charge and gives the coupon slot back", async () => {
    const coupon = await createCoupon({ value: 10, usageLimit: 5 });
    const { orgA, orgB, productA, productB, order } = await twoSellerCodOrder({
      couponId: coupon.id,
      discountAmount: 150,
    });

    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.cancelledAt).not.toBeNull();
    expect(after.status).toBe("CANCELLED");

    const charge = await prisma.paymentTransaction.findFirstOrThrow({
      where: { orderId: order.id, type: "CHARGE" },
    });
    expect(charge.status).toBe("FAILED");

    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usageCount).toBe(0);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).stock).toBe(100);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productB.id } })).stock).toBe(50);
  });
});

describe("cancelOrder - item shapes", () => {
  it("puts a variant's units back on its own shelf", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 100 });
    const variant = await createVariant({ productId: product.id, price: 1200, stock: 30 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 2400,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
      shipping: SHIPPING,
    });
    // A variant line moves variant stock, never the parent product's.
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
    ).toBe(28);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(100);

    activeOrgId.current = org.id;
    await cancelOrder(order.id);

    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
    ).toBe(30);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(100);
  });

  it("groups several products from one seller into a single part", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const other = await createOrganization();
    const p1 = await createProduct({ organizationId: org.id, price: 1000, stock: 100 });
    const p2 = await createProduct({ organizationId: org.id, price: 250, stock: 100 });
    const p3 = await createProduct({ organizationId: other.id, price: 500, stock: 100 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 1000 + 500 + 500,
      currency: "usd",
      exchangeRate: 1,
      items: [
        { productId: p1.id, variantId: null, quantity: 1 },
        { productId: p2.id, variantId: null, quantity: 2 },
        { productId: p3.id, variantId: null, quantity: 1 },
      ],
      shipping: SHIPPING,
    });

    const parts = await prisma.orderSellerPart.findMany({ where: { orderId: order.id } });
    expect(parts).toHaveLength(2);
    // 1000 + 2 x 250, one part.
    expect((await partFor(order.id, org.id)).itemsSubtotal).toBe(1500);

    activeOrgId.current = org.id;
    await cancelOrder(order.id);

    // Both of this seller's products come back; the other seller's does not.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p1.id } })).stock).toBe(100);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p2.id } })).stock).toBe(100);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p3.id } })).stock).toBe(99);
  });

  // Money is stored in the order's currency, so the split must work in para as
  // well as cents - the arithmetic is on integers either way.
  it("splits a discount the same way in a non-USD order", async () => {
    const user = await createUser();
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const pA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 100 });
    const pB = await createProduct({ organizationId: orgB.id, price: 500, stock: 100 });

    // The fixtures carry a USD-only money set, so RSD is derived at the rate:
    // 1000 -> 100.000 para and 500 -> 50.000 para, 150.000 in all.
    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 150000 - 1001,
      currency: "rsd",
      exchangeRate: 100,
      items: [
        { productId: pA.id, variantId: null, quantity: 1 },
        { productId: pB.id, variantId: null, quantity: 1 },
      ],
      shipping: SHIPPING,
    });

    const a = await partFor(order.id, orgA.id);
    const b = await partFor(order.id, orgB.id);
    expect(a.itemsSubtotal).toBe(100000);
    expect(b.itemsSubtotal).toBe(50000);
    expect(order.discountAmount).toBe(1001);
    // 2:1 goods: floors are 667 and 333, and the odd para goes to the larger.
    expect(a.discountShare).toBe(668);
    expect(b.discountShare).toBe(333);
    expect(a.discountShare + b.discountShare).toBe(order.discountAmount);
  });
});

describe("cancelOrder - single seller (the plain case)", () => {
  it("puts the stock back exactly as it was", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 100 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 1000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 1 }],
      shipping: SHIPPING,
    });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(99);

    activeOrgId.current = org.id;
    await cancelOrder(order.id);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(100);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "CANCELLED",
    );
  });
});

describe("markCodPaymentReceived", () => {
  async function deliver(orderId: string, organizationId: string) {
    await prisma.orderSellerPart.update({
      where: { orderId_organizationId: { orderId, organizationId } },
      data: { shippedAt: new Date(), deliveredAt: new Date(), status: "DELIVERED" },
    });
  }

  it("charges commission to the collecting seller alone", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();
    await deliver(order.id, orgA.id);
    await deliver(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    expect(await markCodPaymentReceived(order.id)).toEqual({ success: true });

    const fees = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "FEE" },
    });
    expect(fees).toHaveLength(1);
    expect(fees[0].organizationId).toBe(orgA.id);

    // B has not collected anything, so it owes nothing.
    const balances = await prisma.orgBalance.findMany();
    expect(balances.map((b) => b.organizationId)).toEqual([orgA.id]);
    expect((await partFor(order.id, orgB.id)).codSettledAt).toBeNull();
  });

  it("leaves the order unpaid until every seller has collected", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();
    await deliver(order.id, orgA.id);
    await deliver(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "UNPAID",
    );

    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentStatus).toBe("PAID");
    expect(after.status).toBe("COMPLETED");

    const charge = await prisma.paymentTransaction.findFirstOrThrow({
      where: { orderId: order.id, type: "CHARGE" },
    });
    expect(charge.status).toBe("SUCCEEDED");
  });

  // A withdrawal can itself be what finishes an order: if the only other seller
  // had already collected, the order is paid in full the moment the last one
  // pulls out - and the cash charge has to close with it.
  it("closes the cash charge when a withdrawal settles the order", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();
    await deliver(order.id, orgA.id);

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);

    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentStatus).toBe("PAID");
    expect(after.cancelledAt).toBeNull();

    const charge = await prisma.paymentTransaction.findFirstOrThrow({
      where: { orderId: order.id, type: "CHARGE" },
    });
    expect(charge.status).toBe("SUCCEEDED");
    // Only A's goods and delivery were ever collected: 1000 items + 300 delivery.
    expect(charge.amount).toBe(1300);
    expect(after.total).toBe(1300);
  });

  it("does not wait on a seller that withdrew", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();

    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    await deliver(order.id, orgA.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);

    // A is the only seller left, so its cash completes the order.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "PAID",
    );
  });

  it("refuses before this seller has delivered its own part", async () => {
    const { orgA, orgB, order } = await twoSellerCodOrder();
    await deliver(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    expect(await markCodPaymentReceived(order.id)).toEqual({
      error: "Your part must be delivered before payment is confirmed",
    });
  });

  it("refuses to settle a cancelled part", async () => {
    const { orgA, order } = await twoSellerCodOrder();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    expect(await markCodPaymentReceived(order.id)).toEqual({
      error: "Your part of this order is cancelled",
    });
  });
});

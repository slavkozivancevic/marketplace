import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

/**
 * What each party actually SEES once sellers start dropping out of an order:
 * the seller's list, filters and counters; the seller's ledger; the buyer's
 * per-seller breakdown; the payload the notification emails are built from; and
 * the two places a withdrawn seller could otherwise keep earning credit -
 * bestseller ranking and verified-purchase reviews.
 */

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

// The internal endpoints below are behind a shared key that the test env does
// not carry. Everything else about the environment stays real.
const INTERNAL_KEY = "test-internal-key";
vi.mock("@/env/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env/server")>();
  return { ...actual, env: { ...actual.env, NOTIFICATIONS_API_KEY: INTERNAL_KEY } };
});
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
// The email payload resolves product images through S3; the shape is what
// matters here, not the bytes.
vi.mock("@/services/emailThumb", () => ({
  getEmailThumbUrl: vi.fn().mockResolvedValue("https://cdn.test/img.jpg"),
}));
vi.mock("@/services/notifications", () => ({
  publishOrderCompleted: vi.fn().mockResolvedValue(undefined),
  publishCodOrderPlaced: vi.fn().mockResolvedValue(undefined),
  publishOrderRefunded: vi.fn().mockResolvedValue(undefined),
  publishOrderPartiallyRefunded: vi.fn().mockResolvedValue(undefined),
  publishCodOrderFulfilled: vi.fn().mockResolvedValue(undefined),
  publishCodPaymentReceived: vi.fn().mockResolvedValue(undefined),
  publishCodOrderCancelled: vi.fn().mockResolvedValue(undefined),
  publishOrderShipped: vi.fn().mockResolvedValue(undefined),
  publishOrderTrackingUpdated: vi.fn().mockResolvedValue(undefined),
  publishPayoutReleased: vi.fn().mockResolvedValue(undefined),
  publishOrderDelivered: vi.fn().mockResolvedValue(undefined),
  publishReturnRequested: vi.fn().mockResolvedValue(undefined),
  publishReturnApproved: vi.fn().mockResolvedValue(undefined),
  publishReturnRejected: vi.fn().mockResolvedValue(undefined),
  publishReturnShipped: vi.fn().mockResolvedValue(undefined),
  publishReturnRefunded: vi.fn().mockResolvedValue(undefined),
  publishMemberRoleChanged: vi.fn().mockResolvedValue(undefined),
  publishUserRoleChanged: vi.fn().mockResolvedValue(undefined),
  publishOwnerAutoPromoted: vi.fn().mockResolvedValue(undefined),
  publishMemberRemoved: vi.fn().mockResolvedValue(undefined),
  publishReviewModerated: vi.fn().mockResolvedValue(undefined),
  publishInviteSent: vi.fn().mockResolvedValue(undefined),
  publishInviteAccepted: vi.fn().mockResolvedValue(undefined),
  publishInviteDeclined: vi.fn().mockResolvedValue(undefined),
}));

const { createCodOrder } = await import("./orders");
const { cancelOrder, markCodPaymentReceived } = await import(
  "@/features/orders/actions/updateOrgOrderStatus"
);
const { createShipment, markShipmentDelivered, getOrderSellerParts } = await import(
  "@/features/shipments/db/shipments"
);
const { getOrgOrdersPage, getOrgOrderStatusCounts, getOrgOrderById } = await import(
  "./orgOrders"
);
const { createReturn, transitionReturn } = await import("@/features/returns/db/returns");
const { hasUserPurchasedProduct, getEligibleOrderForReview } = await import(
  "@/features/reviews/db/reviews"
);
const { GET: orderDetails } = await import("@/app/api/internal/order-details/route");
const { POST: recomputeBestsellers } = await import(
  "@/app/api/internal/recompute-bestsellers/route"
);
const { NextRequest } = await import("next/server");

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

/** A 1000 + 500 two-seller COD order with 300 / 200 delivery. */
async function twoSellerCod(qty = { a: 1, b: 1 }) {
  const user = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  const pA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 100 });
  const pB = await createProduct({ organizationId: orgB.id, price: 500, stock: 100 });

  const order = await createCodOrder({
    userId: user.id,
    totalInCurrency: 1000 * qty.a + 500 * qty.b + 500,
    currency: "usd",
    exchangeRate: 1,
    items: [
      { productId: pA.id, variantId: null, quantity: qty.a },
      { productId: pB.id, variantId: null, quantity: qty.b },
    ],
    shipping: SHIPPING,
    shippingTotal: 500,
    shippingByOrg: { [orgA.id]: 300, [orgB.id]: 200 },
  });
  return { user, orgA, orgB, pA, pB, order };
}

async function deliverPart(orderId: string, organizationId: string) {
  await createShipment({ orderId, organizationId });
  await markShipmentDelivered({ orderId, organizationId });
}

const listFor = (organizationId: string, status?: string[]) =>
  getOrgOrdersPage({ organizationId, take: 20, status });

// ─── The seller's list ───────────────────────────────────────────────────────

describe("views: the seller order list", () => {
  it("carries this seller's own part, not the order's axes", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await createShipment({ orderId: order.id, organizationId: orgA.id });

    const forA = await listFor(orgA.id);
    const forB = await listFor(orgB.id);
    expect(forA.items[0].sellerPart?.shippedAt).not.toBeNull();
    expect(forB.items[0].sellerPart?.shippedAt).toBeNull();
    expect(forA.items[0].id).toBe(order.id);
    expect(forB.items[0].id).toBe(order.id);
  });

  it("shows each seller only its own money", async () => {
    const { orgA, orgB } = await twoSellerCod();
    expect((await listFor(orgA.id)).items[0].orgSubtotal).toBe(1000);
    expect((await listFor(orgB.id)).items[0].orgSubtotal).toBe(500);
  });

  // The order's grand total is partly the other seller's revenue.
  it("never hands a seller the order's grand total", async () => {
    const { orgA } = await twoSellerCod();
    const row = (await listFor(orgA.id)).items[0] as Record<string, unknown>;
    expect(row.total).toBeUndefined();
  });

  it("still lists the order for a seller that withdrew", async () => {
    const { orgA, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    const forA = await listFor(orgA.id);
    expect(forA.items).toHaveLength(1);
    expect(forA.items[0].sellerPart?.cancelledAt).not.toBeNull();
  });
});

// ─── Filtering and counting by the seller's own stage ────────────────────────

describe("views: filters and counters follow the seller's own stage", () => {
  it("files a withdrawn seller's order under Cancelled for it alone", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    expect((await listFor(orgA.id, ["CANCELLED"])).items).toHaveLength(1);
    expect((await listFor(orgA.id, ["PENDING"])).items).toHaveLength(0);
    // The order lives on for B, which is still waiting to ship.
    expect((await listFor(orgB.id, ["CANCELLED"])).items).toHaveLength(0);
    expect((await listFor(orgB.id, ["PENDING"])).items).toHaveLength(1);
    void order;
  });

  it("counts each seller's own stage", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ CANCELLED: 1 });
    expect(await getOrgOrderStatusCounts({ organizationId: orgB.id })).toEqual({ PENDING: 1 });
  });

  it("moves a seller through PENDING, SHIPPED, DELIVERED and COMPLETED", async () => {
    const { orgA, order } = await twoSellerCod();
    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ PENDING: 1 });

    await createShipment({ orderId: order.id, organizationId: orgA.id });
    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ SHIPPED: 1 });

    await markShipmentDelivered({ orderId: order.id, organizationId: orgA.id });
    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ DELIVERED: 1 });

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ COMPLETED: 1 });
  });

  // A seller that has collected its cash is done, whatever the other seller is
  // still doing - the order itself is not COMPLETED yet.
  it("shows one seller COMPLETED while the order is still open", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);

    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ COMPLETED: 1 });
    expect(await getOrgOrderStatusCounts({ organizationId: orgB.id })).toEqual({ PENDING: 1 });

    // The order is only part-way: A of two sellers has delivered, so its goods
    // axis is PARTIALLY_FULFILLED and it reads SHIPPED - certainly not COMPLETED,
    // which would claim B's cash had been collected too.
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.fulfillmentStatus).toBe("PARTIALLY_FULFILLED");
    expect(row.paymentStatus).toBe("UNPAID");
    expect(row.status).toBe("SHIPPED");
  });

  it("matches every stage filter against its own counter", async () => {
    const { orgA, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);

    for (const stage of ["PENDING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"]) {
      const counts = await getOrgOrderStatusCounts({ organizationId: orgA.id });
      const listed = (await listFor(orgA.id, [stage])).items.length;
      expect(listed).toBe(counts[stage] ?? 0);
    }
  });
});

// ─── The seller's ledger ─────────────────────────────────────────────────────

describe("views: the seller's payment history", () => {
  it("hides the other seller's commission and payout rows", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    await deliverPart(order.id, orgB.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);

    const forA = await getOrgOrderById(order.id, orgA.id);
    const orgIds = forA!.paymentTransactions.map((t) => t.organizationId);
    expect(orgIds).not.toContain(orgB.id);
    expect(forA!.paymentTransactions.filter((t) => t.type === "FEE")).toHaveLength(1);
  });

  // The order's cash charge covers everyone's goods.
  it("hides the order-level cash charge", async () => {
    const { orgA, order } = await twoSellerCod();
    const forA = await getOrgOrderById(order.id, orgA.id);
    expect(forA!.paymentTransactions.some((t) => t.type === "CHARGE")).toBe(false);
  });

  it("shows this seller only its own items and subtotal", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    const forA = await getOrgOrderById(order.id, orgA.id);
    const forB = await getOrgOrderById(order.id, orgB.id);
    expect(forA!.items).toHaveLength(1);
    expect(forA!.orgSubtotal).toBe(1000);
    expect(forB!.orgSubtotal).toBe(500);
  });

  it("never hands a seller the order's grand total", async () => {
    const { orgA, order } = await twoSellerCod();
    const forA = (await getOrgOrderById(order.id, orgA.id)) as unknown as Record<string, unknown>;
    expect(forA.total).toBeUndefined();
  });

  it("returns nothing for an org with no part in the order", async () => {
    const outsider = await createOrganization();
    const { order } = await twoSellerCod();
    expect(await getOrgOrderById(order.id, outsider.id)).toBeNull();
  });
});

// ─── The buyer's view ────────────────────────────────────────────────────────

describe("views: the buyer's per-seller breakdown", () => {
  it("keeps the withdrawn seller visible, marked cancelled", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    const parts = await getOrderSellerParts(order.id);
    expect(parts).toHaveLength(2);
    const byOrg = new Map(parts.map((p) => [p.organizationId, p]));
    expect(byOrg.get(orgA.id)!.cancelledAt).not.toBeNull();
    expect(byOrg.get(orgA.id)!.status).toBe("CANCELLED");
    expect(byOrg.get(orgB.id)!.cancelledAt).toBeNull();
  });

  it("reports each seller's shipping independently", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await createShipment({
      orderId: order.id,
      organizationId: orgA.id,
      trackingNumber: "TRACK-1",
      carrier: "BEX",
    });

    const byOrg = new Map((await getOrderSellerParts(order.id)).map((p) => [p.organizationId, p]));
    expect(byOrg.get(orgA.id)!.trackingNumber).toBe("TRACK-1");
    expect(byOrg.get(orgA.id)!.carrier).toBe("BEX");
    expect(byOrg.get(orgB.id)!.trackingNumber).toBeNull();
    expect(byOrg.get(orgB.id)!.shippedAt).toBeNull();
  });
});

// ─── The payload the emails are built from ───────────────────────────────────

describe("views: the notification payload", () => {
  const fetchDetails = async (orderId: string) => {
    const res = await orderDetails(
      new NextRequest(`http://localhost/api/internal/order-details?id=${orderId}`, {
        headers: { "x-api-key": INTERNAL_KEY },
      }),
    );
    expect(res.status).toBe(200);
    return res.json();
  };

  it("flags which seller withdrew and how many are left", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    const body = await fetchDetails(order.id);
    expect(body.activeSellerCount).toBe(1);
    expect(body.orderCancelled).toBe(false);

    const byOrg = new Map(body.sellers.map((s: { orgId: string }) => [s.orgId, s]));
    expect(byOrg.get(orgA.id)).toMatchObject({ cancelled: true, status: "CANCELLED" });
    expect(byOrg.get(orgB.id)).toMatchObject({ cancelled: false, status: "PENDING" });
  });

  // Every buyer email prints these lines beneath the order totals.
  it("leaves the withdrawn seller's lines out so the email adds up", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);

    const body = await fetchDetails(order.id);
    expect(body.items.map((i: { orgId: string }) => i.orgId)).toEqual([orgB.id]);
    // B alone: 500 goods + 200 delivery.
    expect(body.total).toBe(700);
    expect(body.shippingTotal).toBe(200);
    const lines = body.items.reduce(
      (s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity,
      0,
    );
    expect(lines - body.discountAmount + body.shippingTotal).toBe(body.total);
  });

  // A cancellation email with an empty table would tell the buyer nothing.
  it("keeps every line once the whole order is gone", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    const body = await fetchDetails(order.id);
    expect(body.activeSellerCount).toBe(0);
    expect(body.orderCancelled).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.sellers.every((s: { cancelled: boolean }) => s.cancelled)).toBe(true);
  });

  it("still gives each seller its own earnings breakdown", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    const body = await fetchDetails(order.id);
    const byOrg = new Map(body.sellers.map((s: { orgId: string }) => [s.orgId, s]));
    // A: 1000 goods, 10% commission, 900 net + 300 delivery.
    expect(byOrg.get(orgA.id)).toMatchObject({ commission: 100, shipping: 300, netPayout: 1200 });
    expect(byOrg.get(orgB.id)).toMatchObject({ commission: 50, shipping: 200, netPayout: 650 });
  });

  it("reports COD settlement per seller", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);

    const body = await fetchDetails(order.id);
    const byOrg = new Map(body.sellers.map((s: { orgId: string }) => [s.orgId, s]));
    expect(byOrg.get(orgA.id)).toMatchObject({ codSettled: true, status: "DELIVERED" });
    expect(byOrg.get(orgB.id)).toMatchObject({ codSettled: false });
  });
});

// ─── Credit a withdrawn seller must not keep ─────────────────────────────────

describe("views: what a withdrawn seller stops earning", () => {
  /** A withdraws, B delivers and collects, so the order completes without A. */
  async function completedWithoutA() {
    const ctx = await twoSellerCod({ a: 3, b: 3 });
    activeOrgId.current = ctx.orgA.id;
    await cancelOrder(ctx.order.id);
    await deliverPart(ctx.order.id, ctx.orgB.id);
    activeOrgId.current = ctx.orgB.id;
    await markCodPaymentReceived(ctx.order.id);
    return ctx;
  }

  it("does not count its units toward the bestseller ranking", async () => {
    const ctx = await completedWithoutA();
    const category = await prisma.category.create({ data: {} });
    await prisma.productCategory.createMany({
      data: [
        { productId: ctx.pA.id, categoryId: category.id },
        { productId: ctx.pB.id, categoryId: category.id },
      ],
    });

    const res = await recomputeBestsellers(
      new NextRequest("http://localhost/api/internal/recompute-bestsellers", {
        method: "POST",
        headers: { "x-api-key": INTERNAL_KEY },
      }),
    );
    expect(res.status).toBe(200);

    // Both sold 3 units on a PAID order, but A's were withdrawn and never sold.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: ctx.pB.id } })).isBestseller).toBe(
      true,
    );
    expect((await prisma.product.findUniqueOrThrow({ where: { id: ctx.pA.id } })).isBestseller).toBe(
      false,
    );
  });

  it("does not earn the buyer a verified-purchase review", async () => {
    const ctx = await completedWithoutA();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ctx.order.id } })).status).toBe(
      "COMPLETED",
    );

    expect(await hasUserPurchasedProduct(ctx.user.id, ctx.pB.id)).toBe(true);
    expect(await hasUserPurchasedProduct(ctx.user.id, ctx.pA.id)).toBe(false);
    expect(await getEligibleOrderForReview(ctx.user.id, ctx.pB.id)).toBe(ctx.order.id);
    expect(await getEligibleOrderForReview(ctx.user.id, ctx.pA.id)).toBeNull();
  });
});
// ─── Refunds belong to the seller whose goods came back ──────────────────────

/**
 * A refund is one seller's business. The order's payment axis is the sum of
 * every seller's refunds, so reading it per seller got both readings wrong: the
 * seller with nothing left was told "partially", and the seller who had never
 * had a unit come back was told the same thing, about somebody else's goods.
 */
describe("views: a refund shows up for that seller only", () => {
  /** Both sellers deliver and collect, then every unit of A's goods comes back. */
  async function orderWithAFullyReturned() {
    const ctx = await twoSellerCod();
    for (const org of [ctx.orgA, ctx.orgB]) {
      await deliverPart(ctx.order.id, org.id);
      activeOrgId.current = org.id;
      await markCodPaymentReceived(ctx.order.id);
    }

    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgA.id } },
    });
    const ret = await createReturn({
      orderId: ctx.order.id,
      organizationId: ctx.orgA.id,
      userId: ctx.user.id,
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    for (const to of ["APPROVED", "SHIPPED", "REFUNDED"] as const) {
      await transitionReturn({
        returnId: ret.id,
        to,
        actor: to === "SHIPPED" ? "buyer" : "seller",
        actorUserId: to === "SHIPPED" ? ctx.user.id : "u",
        actorOrgId: to === "SHIPPED" ? undefined : ctx.orgA.id,
      });
    }
    return ctx;
  }

  it("puts the seller whose goods all came back under Refunded", async () => {
    const { orgA, order } = await orderWithAFullyReturned();

    // The ORDER is only partially refunded - B's goods are still with the buyer.
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.paymentStatus).toBe("PARTIALLY_REFUNDED");

    // A has nothing left and earns nothing from this order.
    expect(await getOrgOrderStatusCounts({ organizationId: orgA.id })).toEqual({ REFUNDED: 1 });
    const refundedForA = await listFor(orgA.id, ["REFUNDED"]);
    expect(refundedForA.items.map((o) => o.id)).toEqual([order.id]);
  });

  it("leaves the seller who had no return at all completed", async () => {
    const { orgB, order } = await orderWithAFullyReturned();

    // The reading that leaked: B's own goods were never touched.
    expect(await getOrgOrderStatusCounts({ organizationId: orgB.id })).toEqual({ COMPLETED: 1 });
    const refundedForB = await listFor(orgB.id, ["REFUNDED"]);
    expect(refundedForB.items).toHaveLength(0);

    const listed = await listFor(orgB.id);
    expect(listed.items.find((o) => o.id === order.id)?.orgRefundedGross).toBe(0);
  });

  it("says the same thing on the order page as in the list", async () => {
    const { orgA, orgB, order } = await orderWithAFullyReturned();

    const forA = await getOrgOrderById(order.id, orgA.id);
    const forB = await getOrgOrderById(order.id, orgB.id);
    // 1000 of goods back for A; nothing for B.
    expect(forA?.orgRefundGross).toBe(1000);
    expect(forB?.orgRefundGross).toBe(0);
  });
});

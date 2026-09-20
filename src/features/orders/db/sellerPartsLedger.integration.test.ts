import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createConnectedAccount,
  createCoupon,
} from "../../../../test/integration/helpers";

/**
 * The ledger and stock side of the seller-part matrix: what each combination of
 * shipping, collecting, withdrawing and returning does to the money rows, the
 * commission balances and the shelves.
 *
 * Money is asserted against figures worked out by hand in the comments, never
 * against the code's own arithmetic.
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
// Every publisher, stubbed. Named individually rather than spread from the real
// module, which builds an SNS client at import. A missing name here is not a
// silent no-op - it throws where the app calls it - so the list is exhaustive.
vi.mock("@/services/notifications", () => ({
  publishOrderCompleted: vi.fn().mockResolvedValue(undefined),
  publishCodOrderPlaced: vi.fn().mockResolvedValue(undefined),
  publishOrderRefunded: vi.fn().mockResolvedValue(undefined),
  publishOrderPartiallyRefunded: vi.fn().mockResolvedValue(undefined),
  publishCodOrderFulfilled: vi.fn().mockResolvedValue(undefined),
  publishCodPaymentReceived: vi.fn().mockResolvedValue(undefined),
  publishCodOrderCancelled: vi.fn().mockResolvedValue(undefined),
  publishMemberRoleChanged: vi.fn().mockResolvedValue(undefined),
  publishUserRoleChanged: vi.fn().mockResolvedValue(undefined),
  publishOwnerAutoPromoted: vi.fn().mockResolvedValue(undefined),
  publishMemberRemoved: vi.fn().mockResolvedValue(undefined),
  publishReviewModerated: vi.fn().mockResolvedValue(undefined),
  publishOrderShipped: vi.fn().mockResolvedValue(undefined),
  publishOrderTrackingUpdated: vi.fn().mockResolvedValue(undefined),
  publishPayoutReleased: vi.fn().mockResolvedValue(undefined),
  publishOrderDelivered: vi.fn().mockResolvedValue(undefined),
  publishReturnRequested: vi.fn().mockResolvedValue(undefined),
  publishReturnApproved: vi.fn().mockResolvedValue(undefined),
  publishReturnRejected: vi.fn().mockResolvedValue(undefined),
  publishReturnShipped: vi.fn().mockResolvedValue(undefined),
  publishReturnRefunded: vi.fn().mockResolvedValue(undefined),
  publishInviteSent: vi.fn().mockResolvedValue(undefined),
  publishInviteAccepted: vi.fn().mockResolvedValue(undefined),
  publishInviteDeclined: vi.fn().mockResolvedValue(undefined),
}));

const { createCodOrder, fulfillOrder } = await import("./orders");
const { cancelOrder, markCodPaymentReceived } = await import(
  "@/features/orders/actions/updateOrgOrderStatus"
);
const { createShipment, markShipmentDelivered } = await import(
  "@/features/shipments/db/shipments"
);
const { createReturn, transitionReturn } = await import("@/features/returns/db/returns");
const { getOrgOrderById } = await import("./orgOrders");

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
 * Two sellers, round numbers so a 10% commission stays exact:
 *   A  1 x 1000 items, 300 delivery
 *   B  1 x  500 items, 200 delivery
 *              subtotal 1500, delivery 500, total 2000
 */
async function twoSellerCod() {
  const user = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  const pA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 100 });
  const pB = await createProduct({ organizationId: orgB.id, price: 500, stock: 100 });

  const order = await createCodOrder({
    userId: user.id,
    totalInCurrency: 2000,
    currency: "usd",
    exchangeRate: 1,
    items: [
      { productId: pA.id, variantId: null, quantity: 1 },
      { productId: pB.id, variantId: null, quantity: 1 },
    ],
    shipping: SHIPPING,
    shippingTotal: 500,
    shippingByOrg: { [orgA.id]: 300, [orgB.id]: 200 },
  });

  return { user, orgA, orgB, pA, pB, order };
}

/**
 * The same order with a coupon on it. The discount is implied by the total the
 * buyer pays (goods + delivery - discount), and split across the parts pro rata
 * by goods - so these two carry 2/3 and 1/3 of it.
 */
async function twoSellerCodWithCoupon(discountAmount: number) {
  const user = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  const pA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 100 });
  const pB = await createProduct({ organizationId: orgB.id, price: 500, stock: 100 });
  const coupon = await createCoupon({ code: "LEDGER", value: 10 });

  const order = await createCodOrder({
    userId: user.id,
    totalInCurrency: 2000 - discountAmount,
    currency: "usd",
    exchangeRate: 1,
    items: [
      { productId: pA.id, variantId: null, quantity: 1 },
      { productId: pB.id, variantId: null, quantity: 1 },
    ],
    shipping: SHIPPING,
    shippingTotal: 500,
    shippingByOrg: { [orgA.id]: 300, [orgB.id]: 200 },
    couponId: coupon.id,
    couponCode: "LEDGER",
  });

  return { user, orgA, orgB, order };
}

const charge = (orderId: string) =>
  prisma.paymentTransaction.findFirstOrThrow({ where: { orderId, type: "CHARGE" } });

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

async function deliverPart(orderId: string, organizationId: string) {
  await createShipment({ orderId, organizationId });
  await markShipmentDelivered({ orderId, organizationId });
}

// ─── COD commission ──────────────────────────────────────────────────────────

describe("matrix: COD commission is charged per seller", () => {
  it("bills each seller on its own goods, not on the order", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    await deliverPart(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);

    const fees = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "FEE" },
      orderBy: { amount: "desc" },
    });
    // 10% of 1000 and of 500 - delivery carries no commission.
    expect(fees.map((f) => f.amount)).toEqual([100, 50]);
    expect(fees[0].organizationId).toBe(orgA.id);
    expect(fees[1].organizationId).toBe(orgB.id);
  });

  it("bills nothing to a seller that withdrew", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    await deliverPart(order.id, orgA.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);

    const fees = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "FEE" },
    });
    expect(fees).toHaveLength(1);
    expect(fees[0].organizationId).toBe(orgA.id);

    const balances = await prisma.orgBalance.findMany();
    expect(balances).toHaveLength(1);
    expect(balances[0].organizationId).toBe(orgA.id);
    expect(balances[0].owedAmount).toBe(100);
  });

  /**
   * The platform tells sellers, on the page and in their email, that a buyer's
   * coupon comes out of the platform's commission and not their earnings. On a
   * card order that is simply true - the platform holds the money and transfers
   * the full net. On COD it has to be MADE true here, because the seller already
   * took the cash and that cash was short by the coupon: the buyer pays
   * `goods - discountShare + delivery` per part. Billing the commission on the
   * gross would quietly hand the seller the bill for the platform's discount.
   */
  it("charges commission net of the coupon share the platform funds", async () => {
    // 300 off 1500 of goods: 200 from A, 100 from B.
    const { orgA, orgB, order } = await twoSellerCodWithCoupon(300);
    await deliverPart(order.id, orgA.id);
    await deliverPart(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);

    const parts = await prisma.orderSellerPart.findMany({
      where: { orderId: order.id },
      orderBy: { itemsSubtotal: "desc" },
    });
    expect(parts.map((p) => p.discountShare)).toEqual([200, 100]);

    // A: commission 100 less its 200 of coupon = 100 OWED BACK to A.
    // B: commission  50 less its 100 of coupon =  50 owed back to B.
    const fees = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "FEE" },
      orderBy: { amount: "asc" },
    });
    expect(fees.map((f) => f.amount)).toEqual([-100, -50]);

    // And the seller is left with exactly what a coupon-free order would have
    // left them: cash at the door, less what they owe.
    for (const [org, goods, delivery] of [
      [orgA.id, 1000, 300],
      [orgB.id, 500, 200],
    ] as const) {
      const part = parts.find((p) => p.organizationId === org)!;
      const cash = part.itemsSubtotal - part.discountShare + part.shippingAmount;
      const owed = (await prisma.orgBalance.findFirstOrThrow({
        where: { organizationId: org },
      })).owedAmount;
      expect(cash - owed).toBe(goods - goods * 0.1 + delivery);
    }
  });

  it("keeps the commission positive when the coupon is smaller than it", async () => {
    // 75 off 1500 of goods: 50 from A, 25 from B, against commissions of 100/50.
    const { orgA, orgB, order } = await twoSellerCodWithCoupon(75);
    await deliverPart(order.id, orgA.id);
    await deliverPart(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);

    const fees = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "FEE" },
      orderBy: { amount: "desc" },
    });
    expect(fees.map((f) => f.amount)).toEqual([50, 25]);
  });

  it("accumulates a seller's debt across orders in the same currency", async () => {
    const first = await twoSellerCod();
    await deliverPart(first.order.id, first.orgA.id);
    activeOrgId.current = first.orgA.id;
    await markCodPaymentReceived(first.order.id);

    // A second order from the same seller.
    const user = await createUser();
    const order2 = await createCodOrder({
      userId: user.id,
      totalInCurrency: 1000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: first.pA.id, variantId: null, quantity: 1 }],
      shipping: SHIPPING,
    });
    await deliverPart(order2.id, first.orgA.id);
    await markCodPaymentReceived(order2.id);

    const balance = await prisma.orgBalance.findFirstOrThrow({
      where: { organizationId: first.orgA.id },
    });
    expect(balance.owedAmount).toBe(200); // 100 + 100
  });
});

// ─── The single cash charge ──────────────────────────────────────────────────

describe("matrix: the order's cash charge", () => {
  it("starts pending for the whole order", async () => {
    const { order } = await twoSellerCod();
    const c = await charge(order.id);
    expect(c.status).toBe("PENDING");
    expect(c.amount).toBe(2000);
  });

  it("shrinks to what is still coming when a seller withdraws", async () => {
    const { orgA, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    const c = await charge(order.id);
    // B alone: 500 items + 200 delivery.
    expect(c.status).toBe("PENDING");
    expect(c.amount).toBe(700);
  });

  it("fails when the last seller withdraws", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);
    expect((await charge(order.id)).status).toBe("FAILED");
  });

  it("succeeds only once every active seller has collected", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    await deliverPart(order.id, orgB.id);

    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    expect((await charge(order.id)).status).toBe("PENDING");

    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);
    const c = await charge(order.id);
    expect(c.status).toBe("SUCCEEDED");
    expect(c.amount).toBe(2000);
  });

  it("succeeds for the reduced amount when a withdrawal completes the order", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);

    activeOrgId.current = orgB.id;
    await cancelOrder(order.id);

    const c = await charge(order.id);
    expect(c.status).toBe("SUCCEEDED");
    expect(c.amount).toBe(1300); // A's 1000 goods + 300 delivery
  });

  // A charge that already succeeded is history and must never be rewritten.
  it("never reopens a charge that already succeeded", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    await deliverPart(order.id, orgB.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    activeOrgId.current = orgB.id;
    await markCodPaymentReceived(order.id);

    // The order is paid, so no further withdrawal is possible anyway.
    activeOrgId.current = orgA.id;
    expect(await cancelOrder(order.id)).toEqual({
      error: "Paid orders must be refunded, not cancelled",
    });
    expect((await charge(order.id)).status).toBe("SUCCEEDED");
  });
});

// ─── Stock ───────────────────────────────────────────────────────────────────

describe("matrix: stock", () => {
  it("comes off every seller's shelf at checkout", async () => {
    const { pA, pB } = await twoSellerCod();
    expect(await stockOf(pA.id)).toBe(99);
    expect(await stockOf(pB.id)).toBe(99);
  });

  it("goes back only to the seller that withdrew", async () => {
    const { orgA, pA, pB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    expect(await stockOf(pA.id)).toBe(100);
    expect(await stockOf(pB.id)).toBe(99);
  });

  it("is untouched by shipping or delivering", async () => {
    const { orgA, pA, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    expect(await stockOf(pA.id)).toBe(99);
  });

  it("is untouched by collecting the cash", async () => {
    const { orgA, pA, order } = await twoSellerCod();
    await deliverPart(order.id, orgA.id);
    activeOrgId.current = orgA.id;
    await markCodPaymentReceived(order.id);
    expect(await stockOf(pA.id)).toBe(99);
  });

  it("leaves an unlimited-stock product alone", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: null });
    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 1000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 1 }],
      shipping: SHIPPING,
    });
    expect(await stockOf(product.id)).toBeNull();

    activeOrgId.current = org.id;
    await cancelOrder(order.id);
    expect(await stockOf(product.id)).toBeNull();
  });
});

// ─── Shipping guards ─────────────────────────────────────────────────────────

describe("matrix: what a withdrawn seller may still do", () => {
  it("cannot ship its part", async () => {
    const { orgA, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    await expect(
      createShipment({ orderId: order.id, organizationId: orgA.id }),
    ).rejects.toThrow();
  });

  it("cannot mark its part delivered", async () => {
    const { orgA, order } = await twoSellerCod();
    await createShipment({ orderId: order.id, organizationId: orgA.id });
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    await expect(
      markShipmentDelivered({ orderId: order.id, organizationId: orgA.id }),
    ).rejects.toThrow();
  });

  it("does not block the sellers who stayed", async () => {
    const { orgA, orgB, order } = await twoSellerCod();
    activeOrgId.current = orgA.id;
    await cancelOrder(order.id);
    await expect(deliverPart(order.id, orgB.id)).resolves.not.toThrow();
  });

  it("cannot be delivered before it has shipped", async () => {
    const { orgA, order } = await twoSellerCod();
    await expect(
      markShipmentDelivered({ orderId: order.id, organizationId: orgA.id }),
    ).rejects.toThrow();
  });

  it("cannot ship an order it has no part in", async () => {
    const outsider = await createOrganization();
    const { order } = await twoSellerCod();
    await expect(
      createShipment({ orderId: order.id, organizationId: outsider.id }),
    ).rejects.toThrow();
  });
});

// ─── Returns on a COD order that carried a coupon ────────────────────────────

/**
 * The coupon has to unwind exactly as it wound up.
 *
 * On the way in, the seller collected `goods - discountShare + delivery` in cash
 * and was billed `commission - discountShare` for it (markCodPaymentReceived).
 * On the way out, the buyer gets back what they paid for the returned goods and
 * the seller's bill is reversed by the same shape. If either half is measured
 * against the gross instead, the two disagree and the seller is left owing a
 * commission on goods they no longer have - or credited for one twice.
 */
describe("matrix: a COD refund unwinds the coupon symmetrically", () => {
  /**
   * Both sellers deliver and collect - a return is only eligible once the order
   * is actually paid, which for COD means every active part has its cash in -
   * and the buyer then returns all of B's goods.
   */
  async function collectThenReturnAllOfB(discountAmount: number) {
    const ctx = await twoSellerCodWithCoupon(discountAmount);
    await deliverPart(ctx.order.id, ctx.orgA.id);
    await deliverPart(ctx.order.id, ctx.orgB.id);
    activeOrgId.current = ctx.orgA.id;
    await markCodPaymentReceived(ctx.order.id);
    activeOrgId.current = ctx.orgB.id;
    await markCodPaymentReceived(ctx.order.id);

    const bItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgB.id } },
    });
    const ret = await createReturn({
      orderId: ctx.order.id,
      organizationId: ctx.orgB.id,
      userId: ctx.user.id,
      items: [{ orderItemId: bItem.id, quantity: 1 }],
    });
    for (const to of ["APPROVED", "SHIPPED", "REFUNDED"] as const) {
      await transitionReturn({
        returnId: ret.id,
        to,
        actor: to === "SHIPPED" ? "buyer" : "seller",
        actorUserId: to === "SHIPPED" ? ctx.user.id : "u",
        actorOrgId: to === "SHIPPED" ? undefined : ctx.orgB.id,
      });
    }
    return { ...ctx, returnId: ret.id };
  }

  it("refunds the buyer what they paid for those goods, delivery untouched", async () => {
    // B's goods are 500 gross and carry 100 of the 300 coupon, so the buyer paid
    // 400 for them. Their 200 of delivery is not refundable and stays put.
    const ctx = await collectThenReturnAllOfB(300);

    const ret = await prisma.return.findUniqueOrThrow({ where: { id: ctx.returnId } });
    expect(ret.refundAmount).toBe(400);

    // The ledger row stays on the gross - that is what the payout views net.
    const refund = await prisma.paymentTransaction.findFirstOrThrow({
      where: { orderId: ctx.order.id, type: "REFUND" },
    });
    expect(refund.amount).toBe(500);
  });

  it("leaves the seller owing nothing once all its goods are back", async () => {
    const ctx = await collectThenReturnAllOfB(300);

    // Accrued on collection: commission 50 less its 100 coupon share = 50 owed
    // BACK to B. Returning every item reverses exactly that, so the running
    // balance lands on zero - not on a stray credit, and not on a commission for
    // goods B no longer holds.
    const balance = await prisma.orgBalance.findFirst({
      where: { organizationId: ctx.orgB.id },
    });
    expect(balance?.owedAmount ?? 0).toBe(0);
  });

  it("does the same when the coupon is smaller than the commission", async () => {
    // 75 off: B carries 25 of it against a commission of 50, so 25 was owed and
    // the same 25 comes off again.
    const ctx = await collectThenReturnAllOfB(75);

    const balance = await prisma.orgBalance.findFirst({
      where: { organizationId: ctx.orgB.id },
    });
    expect(balance?.owedAmount ?? 0).toBe(0);
  });
});

// ─── An uneven multi-seller order, returned to the last unit ─────────────────

/**
 * The rounding stress case.
 *
 * Prices and quantities are deliberately awkward so every split lands on a
 * fraction: the coupon has to be apportioned across sellers, and then across the
 * units each seller gets back. Three separate mechanisms round here - the part
 * shares (floor, remainder to the largest), the buyer's refund per return, and
 * the commission reversal - and if any two disagree by a single unit, the money
 * does not close: a seller ends up owing a commission on goods they no longer
 * have, or the buyer is short a unit of their own money.
 *
 *   A  2 x 1999 = 3998 goods, 300 delivery
 *   B  3 x  501 = 1503 goods, 200 delivery
 *               goods 5501, delivery 500, coupon 1100 -> buyer pays 4901
 */
describe("matrix: an uneven order with a coupon, returned in full", () => {
  async function unevenPaidOrder() {
    const user = await createUser();
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const pA = await createProduct({ organizationId: orgA.id, price: 1999, stock: 100 });
    const pB = await createProduct({ organizationId: orgB.id, price: 501, stock: 100 });
    const coupon = await createCoupon({ code: "UNEVEN", value: 20 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 5501 + 500 - 1100,
      currency: "usd",
      exchangeRate: 1,
      items: [
        { productId: pA.id, variantId: null, quantity: 2 },
        { productId: pB.id, variantId: null, quantity: 3 },
      ],
      shipping: SHIPPING,
      shippingTotal: 500,
      shippingByOrg: { [orgA.id]: 300, [orgB.id]: 200 },
      couponId: coupon.id,
      couponCode: "UNEVEN",
    });

    for (const org of [orgA, orgB]) {
      await deliverPart(order.id, org.id);
      activeOrgId.current = org.id;
      await markCodPaymentReceived(order.id);
    }
    return { user, orgA, orgB, order };
  }

  /** Returns `quantity` units of this seller's line, all the way to REFUNDED. */
  async function returnUnits(
    ctx: { user: { id: string }; order: { id: string } },
    organizationId: string,
    quantity: number,
  ) {
    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId } },
    });
    const ret = await createReturn({
      orderId: ctx.order.id,
      organizationId,
      userId: ctx.user.id,
      items: [{ orderItemId: item.id, quantity }],
    });
    for (const to of ["APPROVED", "SHIPPED", "REFUNDED"] as const) {
      await transitionReturn({
        returnId: ret.id,
        to,
        actor: to === "SHIPPED" ? "buyer" : "seller",
        actorUserId: to === "SHIPPED" ? ctx.user.id : "u",
        actorOrgId: to === "SHIPPED" ? undefined : organizationId,
      });
    }
    return prisma.return.findUniqueOrThrow({ where: { id: ret.id } });
  }

  it("splits the coupon across the parts without losing a unit", async () => {
    const { orgA, orgB, order } = await unevenPaidOrder();
    const parts = await prisma.orderSellerPart.findMany({
      where: { orderId: order.id },
      orderBy: { itemsSubtotal: "desc" },
    });
    // 1100 * 3998/5501 = 799.35 and 1100 * 1503/5501 = 300.54; floored that is
    // 799 + 300 = 1099, and the stray unit goes to the larger part.
    expect(parts.map((p) => p.discountShare)).toEqual([800, 300]);
    expect(parts.reduce((s, p) => s + p.discountShare, 0)).toBe(1100);
    expect(parts.map((p) => p.organizationId)).toEqual([orgA.id, orgB.id]);
  });

  it("gives the buyer back exactly what they paid, over several returns", async () => {
    const ctx = await unevenPaidOrder();

    // B comes back a unit at a time, A in one go - the buyer's refunds must
    // still add up to what they actually paid for goods (5501 - 1100).
    const refunds = [
      await returnUnits(ctx, ctx.orgB.id, 1),
      await returnUnits(ctx, ctx.orgB.id, 2),
      await returnUnits(ctx, ctx.orgA.id, 2),
    ];
    const total = refunds.reduce((s, r) => s + (r.refundAmount ?? 0), 0);
    expect(total).toBe(4401);
  });

  it("closes both sellers' books at zero when everything comes back", async () => {
    const ctx = await unevenPaidOrder();
    await returnUnits(ctx, ctx.orgB.id, 1);
    await returnUnits(ctx, ctx.orgB.id, 2);
    await returnUnits(ctx, ctx.orgA.id, 2);

    const balances = await prisma.orgBalance.findMany();
    for (const b of balances) {
      expect(b.owedAmount).toBe(0);
    }
  });

  it("reaches REFUNDED once the last unit is back", async () => {
    const ctx = await unevenPaidOrder();
    await returnUnits(ctx, ctx.orgB.id, 1);
    await returnUnits(ctx, ctx.orgB.id, 2);
    await returnUnits(ctx, ctx.orgA.id, 2);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: ctx.order.id } });
    expect(row.paymentStatus).toBe("REFUNDED");
  });
});

// ─── A seller cannot both withdraw and be returned to ────────────────────────

/**
 * The two terminal paths for one seller's goods must not overlap.
 *
 * Withdrawing says the goods never left; a return says they came back. Both at
 * once would credit the same units twice - once by dropping them out of the
 * order total, once by refunding them - and on a COD order the seller would be
 * handed back a commission they were never charged. The guard is in
 * `createReturn`, and this pins it from both directions rather than trusting
 * that the UI never offers the button.
 */
describe("matrix: a withdrawn seller is closed to returns", () => {
  it("refuses a return on goods the seller withdrew", async () => {
    const ctx = await twoSellerCod();
    // A withdraws; B delivers and collects, so the ORDER is paid and a return is
    // otherwise eligible - the only thing standing in the way is A's own part.
    activeOrgId.current = ctx.orgA.id;
    await cancelOrder(ctx.order.id);
    await deliverPart(ctx.order.id, ctx.orgB.id);
    activeOrgId.current = ctx.orgB.id;
    await markCodPaymentReceived(ctx.order.id);

    const aItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgA.id } },
    });

    await expect(
      createReturn({
        orderId: ctx.order.id,
        organizationId: ctx.orgA.id,
        userId: ctx.user.id,
        items: [{ orderItemId: aItem.id, quantity: 1 }],
      }),
    ).rejects.toThrow();
  });

  /**
   * The reverse direction is closed by arithmetic rather than by a check of its
   * own, and that is worth pinning: a return needs the order PAID, a withdrawal
   * needs it UNPAID. The two windows cannot overlap, so no seller ever sits in a
   * state where both are on offer - which is why there is no third guard, and
   * why one must not be removed on the assumption that the other covers it.
   */
  it("refuses a withdrawal once the order is paid, which is when returns open", async () => {
    const ctx = await twoSellerCod();
    for (const org of [ctx.orgA, ctx.orgB]) {
      await deliverPart(ctx.order.id, org.id);
      activeOrgId.current = org.id;
      await markCodPaymentReceived(ctx.order.id);
    }

    const bItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgB.id } },
    });
    // Eligible only because the order is paid.
    await createReturn({
      orderId: ctx.order.id,
      organizationId: ctx.orgB.id,
      userId: ctx.user.id,
      items: [{ orderItemId: bItem.id, quantity: 1 }],
    });

    activeOrgId.current = ctx.orgB.id;
    const res = await cancelOrder(ctx.order.id);
    expect("error" in res).toBe(true);

    const part = await prisma.orderSellerPart.findUniqueOrThrow({
      where: { orderId_organizationId: { orderId: ctx.order.id, organizationId: ctx.orgB.id } },
    });
    expect(part.cancelledAt).toBeNull();
  });
});

// ─── Returns against a partially cancelled order ─────────────────────────────

describe("matrix: returns after another seller withdrew", () => {
  /** A withdraws; B delivers, collects, then the buyer returns all of B's goods. */
  async function returnAllOfB() {
    const ctx = await twoSellerCod();
    activeOrgId.current = ctx.orgA.id;
    await cancelOrder(ctx.order.id);

    await deliverPart(ctx.order.id, ctx.orgB.id);
    activeOrgId.current = ctx.orgB.id;
    await markCodPaymentReceived(ctx.order.id);

    const bItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgB.id } },
    });
    const ret = await createReturn({
      orderId: ctx.order.id,
      organizationId: ctx.orgB.id,
      userId: ctx.user.id,
      items: [{ orderItemId: bItem.id, quantity: 1 }],
    });
    await transitionReturn({
      returnId: ret.id,
      to: "APPROVED",
      actor: "seller",
      actorUserId: "u",
      actorOrgId: ctx.orgB.id,
    });
    await transitionReturn({
      returnId: ret.id,
      to: "SHIPPED",
      actor: "buyer",
      actorUserId: ctx.user.id,
    });
    await transitionReturn({
      returnId: ret.id,
      to: "REFUNDED",
      actor: "seller",
      actorUserId: "u",
      actorOrgId: ctx.orgB.id,
    });
    return ctx;
  }

  // The bar for "fully refunded" is total + discount - delivery. If the totals
  // had stayed at the whole order's while one seller withdrew, that bar would
  // have been unreachable and the order would sit PARTIALLY_REFUNDED forever.
  it("reaches REFUNDED when the remaining seller's goods all come back", async () => {
    const ctx = await returnAllOfB();
    const row = await prisma.order.findUniqueOrThrow({ where: { id: ctx.order.id } });
    expect(row.paymentStatus).toBe("REFUNDED");
    expect(row.status).toBe("REFUNDED");
  });

  it("refunds only the remaining seller's goods, never the withdrawn seller's", async () => {
    const ctx = await returnAllOfB();
    const refunds = await prisma.paymentTransaction.findMany({
      where: { orderId: ctx.order.id, type: "REFUND" },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].organizationId).toBe(ctx.orgB.id);
    expect(refunds[0].amount).toBe(500); // B's goods; delivery is never refunded
  });

  it("puts the returned units back and leaves the rest alone", async () => {
    const ctx = await returnAllOfB();
    expect(await stockOf(ctx.pB.id)).toBe(100); // sold then returned
    expect(await stockOf(ctx.pA.id)).toBe(100); // withdrawn, restocked at cancel
  });

  it("credits the commission back to the refunding seller only", async () => {
    const ctx = await returnAllOfB();
    const balance = await prisma.orgBalance.findFirstOrThrow({
      where: { organizationId: ctx.orgB.id },
    });
    // 10% of 500 accrued, then credited back on the full return.
    expect(balance.owedAmount).toBe(0);
  });

  it("refuses a return on a withdrawn seller's goods", async () => {
    const ctx = await twoSellerCod();
    activeOrgId.current = ctx.orgA.id;
    await cancelOrder(ctx.order.id);
    await deliverPart(ctx.order.id, ctx.orgB.id);
    activeOrgId.current = ctx.orgB.id;
    await markCodPaymentReceived(ctx.order.id);

    const aItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgA.id } },
    });
    await expect(
      createReturn({
        orderId: ctx.order.id,
        organizationId: ctx.orgA.id,
        userId: ctx.user.id,
        items: [{ orderItemId: aItem.id, quantity: 1 }],
      }),
    ).rejects.toThrow();
  });

  it("refuses a return before that seller has delivered", async () => {
    const ctx = await twoSellerCod();
    await deliverPart(ctx.order.id, ctx.orgA.id);
    await deliverPart(ctx.order.id, ctx.orgB.id);
    activeOrgId.current = ctx.orgA.id;
    await markCodPaymentReceived(ctx.order.id);
    activeOrgId.current = ctx.orgB.id;
    await markCodPaymentReceived(ctx.order.id);

    // Undo B's delivery to prove the guard reads the part, not the order.
    await prisma.orderSellerPart.update({
      where: { orderId_organizationId: { orderId: ctx.order.id, organizationId: ctx.orgB.id } },
      data: { deliveredAt: null, status: "SHIPPED" },
    });
    const bItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: ctx.order.id, product: { organizationId: ctx.orgB.id } },
    });
    await expect(
      createReturn({
        orderId: ctx.order.id,
        organizationId: ctx.orgB.id,
        userId: ctx.user.id,
        items: [{ orderItemId: bItem.id, quantity: 1 }],
      }),
    ).rejects.toThrow();
  });
});

// ─── Card orders ─────────────────────────────────────────────────────────────

describe("matrix: card orders", () => {
  async function cardOrder() {
    const user = await createUser();
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    await createConnectedAccount({ organizationId: orgA.id, payoutsEnabled: true });
    await createConnectedAccount({ organizationId: orgB.id, payoutsEnabled: true });
    const pA = await createProduct({ organizationId: orgA.id, price: 1000, stock: 100 });
    const pB = await createProduct({ organizationId: orgB.id, price: 500, stock: 100 });

    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${Math.random()}`,
      paymentIntentId: `pi_${Math.random()}`,
      totalCents: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [
        { productId: pA.id, variantId: null, quantity: 1 },
        { productId: pB.id, variantId: null, quantity: 1 },
      ],
      shipping: SHIPPING,
      shippingTotal: 500,
      shippingByOrg: { [orgA.id]: 300, [orgB.id]: 200 },
    });
    return { user, orgA, orgB, pA, pB, order };
  }

  it("is paid on arrival, so no seller may cancel its part", async () => {
    const { orgA, order } = await cardOrder();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "PAID",
    );
    activeOrgId.current = orgA.id;
    expect(await cancelOrder(order.id)).toEqual({
      error: "Paid orders must be refunded, not cancelled",
    });
  });

  it("refuses a COD cash confirmation", async () => {
    const { orgA, order } = await cardOrder();
    activeOrgId.current = orgA.id;
    expect(await markCodPaymentReceived(order.id)).toEqual({ error: "Not a COD order" });
  });

  it("pays each seller its own net plus its own delivery, on its own shipment", async () => {
    const { orgA, orgB, order } = await cardOrder();
    await createShipment({ orderId: order.id, organizationId: orgA.id });

    const payouts = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "PAYOUT" },
    });
    expect(payouts).toHaveLength(1);
    expect(payouts[0].organizationId).toBe(orgA.id);
    // 1000 less 10% commission, plus A's own 300 delivery.
    expect(payouts[0].amount).toBe(1200);

    await createShipment({ orderId: order.id, organizationId: orgB.id });
    const both = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "PAYOUT" },
      orderBy: { amount: "desc" },
    });
    // 500 less 10%, plus B's own 200 delivery.
    expect(both.map((p) => p.amount)).toEqual([1200, 650]);
  });

  it("pays a seller once, however often it edits its tracking", async () => {
    const { orgA, order } = await cardOrder();
    await createShipment({ orderId: order.id, organizationId: orgA.id, trackingNumber: "1" });
    await createShipment({ orderId: order.id, organizationId: orgA.id, trackingNumber: "2" });
    const payouts = await prisma.paymentTransaction.findMany({
      where: { orderId: order.id, type: "PAYOUT", organizationId: orgA.id },
    });
    expect(payouts).toHaveLength(1);
  });
});

// ─── What the seller's ledger row says versus what their balance did ─────────

/**
 * The COD commission row is accrued NET of the coupon slice the platform funds,
 * so the credit that comes back when goods return has to be net of it too.
 *
 * Read the gross commission instead and nothing fails - the balance is still
 * right, only the seller's own ledger row claims more came back than did. That
 * is a lie about money, and the only way to catch it is to assert the figure on
 * the page against the movement on the balance, which is what this does.
 */
describe("matrix: the commission credit on screen is the one on the balance", () => {
  /** One seller, 2 x 500 of goods and 300 delivery, with a coupon of `discount`. */
  async function paidCodOrder(discount: number) {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 500, stock: 100 });
    const coupon = await createCoupon({ code: "CREDIT", value: 10 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 1000 + 300 - discount,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
      shippingTotal: 300,
      shippingByOrg: { [org.id]: 300 },
      couponId: coupon.id,
      couponCode: "CREDIT",
    });

    await deliverPart(order.id, org.id);
    activeOrgId.current = org.id;
    await markCodPaymentReceived(order.id);
    return { user, org, order };
  }

  async function returnOneUnit(ctx: { user: { id: string }; org: { id: string }; order: { id: string } }) {
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: ctx.order.id } });
    const ret = await createReturn({
      orderId: ctx.order.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    for (const to of ["APPROVED", "SHIPPED", "REFUNDED"] as const) {
      await transitionReturn({
        returnId: ret.id,
        to,
        actor: to === "SHIPPED" ? "buyer" : "seller",
        actorUserId: to === "SHIPPED" ? ctx.user.id : "u",
        actorOrgId: to === "SHIPPED" ? undefined : ctx.org.id,
      });
    }
  }

  const feeRow = async (orderId: string, organizationId: string) => {
    const detail = await getOrgOrderById(orderId, organizationId);
    return detail!.paymentTransactions.find((t) => t.type === "FEE")!;
  };

  const balanceOf = async (organizationId: string) =>
    (await prisma.orgBalance.findFirst({ where: { organizationId } }))?.owedAmount ?? 0;

  it("credits the coupon-netted commission, not the gross one", async () => {
    // Goods 1000, commission 100, coupon 30 - so 70 was accrued. One of the two
    // units comes back: 50 of commission less the 15 of coupon riding on it,
    // which is 35. The gross reading would have claimed 50.
    const ctx = await paidCodOrder(30);
    expect(await balanceOf(ctx.org.id)).toBe(70);

    await returnOneUnit(ctx);

    const after = await balanceOf(ctx.org.id);
    expect(after).toBe(35);

    const fee = await feeRow(ctx.order.id, ctx.org.id);
    expect(fee.amount).toBe(70);
    expect(fee.reversedNet).toBe(70 - after);
    expect(fee.refundState).toBe("partial");
  });

  it("shows a credit the platform owed SHRINKING, rather than nothing at all", async () => {
    // Coupon 300 against a commission of 100: the platform owes the seller 200.
    // A unit back takes 150 of coupon off against 50 of commission, so the debt
    // the platform carries drops to 100. Signed the other way round, and a row
    // whose reversal is negative used to be dismissed as "nothing reversed".
    const ctx = await paidCodOrder(300);
    expect(await balanceOf(ctx.org.id)).toBe(-200);

    await returnOneUnit(ctx);

    const after = await balanceOf(ctx.org.id);
    expect(after).toBe(-100);

    const fee = await feeRow(ctx.order.id, ctx.org.id);
    expect(fee.amount).toBe(-200);
    expect(fee.reversedNet).toBe(-100);
    expect(fee.refundState).toBe("partial");
  });

  it("closes the row as fully reversed once every unit is back", async () => {
    const ctx = await paidCodOrder(30);
    await returnOneUnit(ctx);
    await returnOneUnit(ctx);

    expect(await balanceOf(ctx.org.id)).toBe(0);
    const fee = await feeRow(ctx.order.id, ctx.org.id);
    expect(fee.refundState).toBe("full");
  });
});

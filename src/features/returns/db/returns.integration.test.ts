import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createReturn } from "./returns";
import { fulfillOrder } from "@/features/orders/db/orders";
import { ForbiddenError } from "@/features/common/errors/domainErrors";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createCoupon,
  createConnectedAccount,
} from "../../../../test/integration/helpers";
import { transitionReturn } from "./returns";

// returns.ts constructs a real Stripe client at import time (for the refund
// flow) - stub it so the (empty in test) API key doesn't throw. Not called on
// any path exercised here (the guard rejects before settleReturnRefund runs).
vi.mock("@/services/stripe", () => ({
  stripe: { refunds: { create: vi.fn() }, transfers: { createReversal: vi.fn() } },
}));

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
});

// A delivered, paid card order for one seller - the minimum a buyer needs to be
// eligible to open a return.
async function deliveredOrder(qty = 2) {
  const user = await createUser();
  const org = await createOrganization();
  const product = await createProduct({ organizationId: org.id, price: 1000, stock: 10 });

  const order = await fulfillOrder({
    userId: user.id,
    stripeSessionId: `cs_${randomUUID()}`,
    totalCents: 1000 * qty,
    currency: "usd",
    exchangeRate: 1,
    items: [{ productId: product.id, variantId: null, quantity: qty }],
    shipping: SHIPPING,
  });

  // The order already has one seller part per seller, created with it. Returns
  // need this seller's part delivered, so walk it through shipped -> delivered.
  await prisma.orderSellerPart.update({
    where: { orderId_organizationId: { orderId: order.id, organizationId: org.id } },
    data: { shippedAt: new Date(), deliveredAt: new Date(), status: "DELIVERED" },
  });

  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });

  return { user, org, order, orderItem };
}

describe("createReturn - external refund guard", () => {
  it("allows a return when nothing has been refunded externally", async () => {
    const { user, org, order, orderItem } = await deliveredOrder(2);

    const created = await createReturn({
      orderId: order.id,
      organizationId: org.id,
      userId: user.id,
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });

    expect(created.id).toBeTruthy();
  });

  it("blocks a return once the order has an external (Stripe dashboard) refund", async () => {
    const { user, org, order, orderItem } = await deliveredOrder(2);

    // A manual refund from the Stripe dashboard isn't scoped to a line item
    // (reconcileStripeRefund records it with organizationId: null).
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "re_manual",
        amount: 1000,
        currency: "usd",
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PARTIALLY_REFUNDED" },
    });

    const attempt = createReturn({
      orderId: order.id,
      organizationId: org.id,
      userId: user.id,
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
    await expect(attempt).rejects.toMatchObject({
      i18n: { key: "returnBlockedExternalRefund" },
    });
    expect(await prisma.return.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("does not block a return refunded only through the app's own Return flow (org-scoped)", async () => {
    const { user, org, order, orderItem } = await deliveredOrder(2);

    // An org-scoped refund (organizationId set) comes from the app's own Return
    // flow, not an external dashboard refund - must not trip the guard.
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId: org.id,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "re_app_return",
        amount: 1000,
        currency: "usd",
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PARTIALLY_REFUNDED" },
    });

    const created = await createReturn({
      orderId: order.id,
      organizationId: org.id,
      userId: user.id,
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });

    expect(created.id).toBeTruthy();
  });
});

/**
 * The card path, where the refund amount is not an internal figure but the one
 * handed to Stripe. Refunding the gross there is not a rounding nit: it exceeds
 * what was captured (the buyer paid the discounted total) and the charge is
 * rejected outright.
 */
describe("settleReturnRefund - a card order carrying a coupon", () => {
  async function paidCardOrderWithCoupon() {
    const user = await createUser();
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    await createConnectedAccount({ organizationId: orgA.id, payoutsEnabled: true });
    await createConnectedAccount({ organizationId: orgB.id, payoutsEnabled: true });
    const pA = await createProduct({ organizationId: orgA.id, price: 1999, stock: 100 });
    const pB = await createProduct({ organizationId: orgB.id, price: 501, stock: 100 });
    const coupon = await createCoupon({ code: "CARD20", value: 20 });

    // Same uneven shape as the COD case: goods 5501, delivery 500, coupon 1100.
    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${randomUUID()}`,
      totalCents: 5501 + 500 - 1100,
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
      couponCode: "CARD20",
    });

    for (const org of [orgA, orgB]) {
      await prisma.orderSellerPart.update({
        where: { orderId_organizationId: { orderId: order.id, organizationId: org.id } },
        data: { shippedAt: new Date(), deliveredAt: new Date(), status: "DELIVERED" },
      });
    }
    return { user, orgA, orgB, order };
  }

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

  it("never refunds more than the buyer paid, across every seller and part return", async () => {
    const ctx = await paidCardOrderWithCoupon();

    const refunds = [
      await returnUnits(ctx, ctx.orgB.id, 1),
      await returnUnits(ctx, ctx.orgB.id, 2),
      await returnUnits(ctx, ctx.orgA.id, 2),
    ];

    // Goods 5501 less the 1100 coupon: the buyer paid 4401 for them, and gets
    // back exactly that - never the 5501 gross, and never a unit of the 500
    // delivery.
    expect(refunds.reduce((s, r) => s + (r.refundAmount ?? 0), 0)).toBe(4401);

    const ledger = await prisma.paymentTransaction.aggregate({
      where: { orderId: ctx.order.id, type: "REFUND" },
      _sum: { amount: true },
    });
    // The ledger rows stay on the gross - that is what the payout views net.
    expect(ledger._sum.amount).toBe(5501);
  });

  it("closes the order as fully refunded once every unit is back", async () => {
    const ctx = await paidCardOrderWithCoupon();
    await returnUnits(ctx, ctx.orgA.id, 2);
    await returnUnits(ctx, ctx.orgB.id, 3);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: ctx.order.id } });
    expect(row.paymentStatus).toBe("REFUNDED");
  });
});

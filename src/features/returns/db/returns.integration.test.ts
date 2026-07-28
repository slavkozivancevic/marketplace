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
} from "../../../../test/integration/helpers";

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

  await prisma.shipment.create({
    data: { orderId: order.id, organizationId: org.id, deliveredAt: new Date() },
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

import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createCodOrder, fulfillOrder, reconcileStripeRefund } from "./orders";
import { InsufficientStockError } from "@/features/common/errors/domainErrors";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createVariant,
} from "../../../../test/integration/helpers";

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

describe("createCodOrder - stock guard", () => {
  it("creates the order and atomically decrements product stock", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 5 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
    });

    expect(order.id).toBeTruthy();
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(3);

    // The order line item was persisted.
    const itemCount = await prisma.orderItem.count({ where: { orderId: order.id } });
    expect(itemCount).toBe(1);
  });

  it("throws and rolls back when quantity exceeds stock", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 1 });

    await expect(
      createCodOrder({
        userId: user.id,
        totalInCurrency: 3000,
        currency: "usd",
        exchangeRate: 1,
        items: [{ productId: product.id, variantId: null, quantity: 3 }],
        shipping: SHIPPING,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // Stock untouched and no order created (transaction rolled back).
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });

  it("decrements variant stock for a variant line", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: null });
    const variant = await createVariant({ productId: product.id, price: 1500, stock: 4 });

    await createCodOrder({
      userId: user.id,
      totalInCurrency: 3000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
      shipping: SHIPPING,
    });

    const after = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(after?.stock).toBe(2);
  });
});

describe("fulfillOrder - card checkout", () => {
  it("creates a paid, unfulfilled order, decrements stock, and records a CHARGE row", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 5 });

    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${randomUUID()}`,
      paymentIntentId: "pi_test_1",
      totalCents: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
    });

    expect(order.paymentStatus).toBe("PAID");
    expect(order.fulfillmentStatus).toBe("UNFULFILLED");
    // Paid but nothing shipped yet -> PROCESSING (not COMPLETED).
    expect(order.status).toBe("PROCESSING");

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(3);

    const charge = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, type: "CHARGE" },
    });
    expect(charge).toMatchObject({
      status: "SUCCEEDED",
      provider: "STRIPE",
      providerId: "pi_test_1",
      amount: 2000,
    });
  });

  it("is idempotent for a repeated Stripe session id", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 5 });
    const sessionId = `cs_${randomUUID()}`;

    const args = {
      userId: user.id,
      stripeSessionId: sessionId,
      paymentIntentId: "pi_test_2",
      totalCents: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
    };

    const first = await fulfillOrder(args);
    const second = await fulfillOrder(args);

    // Same order returned, no duplicate side effects.
    expect(second.id).toBe(first.id);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.paymentTransaction.count({ where: { type: "CHARGE" } })).toBe(1);
    // Stock decremented exactly once.
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(3);
  });

  it("recovers the coupon discount net of shipping", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 5 });

    // subtotal = 1000 * 2 = 2000; total = subtotal - discount + shipping.
    // 2200 = 2000 - 300 + 500 -> discount must reconstruct to 300.
    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${randomUUID()}`,
      totalCents: 2200,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
      shippingTotal: 500,
    });

    expect(order.discountAmount).toBe(300);
    expect(order.shippingTotal).toBe(500);
  });

  it("throws InsufficientStockError and rolls back on oversell", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 1 });

    await expect(
      fulfillOrder({
        userId: user.id,
        stripeSessionId: `cs_${randomUUID()}`,
        totalCents: 3000,
        currency: "usd",
        exchangeRate: 1,
        items: [{ productId: product.id, variantId: null, quantity: 3 }],
        shipping: SHIPPING,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("reconcileStripeRefund - external (dashboard) refunds", () => {
  async function cardOrder(stock = 5, qty = 2) {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock });
    const sessionId = `cs_${randomUUID()}`;
    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: sessionId,
      totalCents: 1000 * qty,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: qty }],
      shipping: SHIPPING,
    });
    return { order, sessionId, product };
  }

  it("marks the order REFUNDED and restocks on a full external refund", async () => {
    const { order, sessionId, product } = await cardOrder(5, 2); // total 2000, stock -> 3

    const result = await reconcileStripeRefund(sessionId, [{ id: "re_full", amount: 2000 }]);

    expect(result?.id).toBe(order.id);
    const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
    expect(refreshed?.paymentStatus).toBe("REFUNDED");
    expect(refreshed?.status).toBe("REFUNDED");
    // Full refund with no prior return -> items restocked (3 back to 5).
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(5);
    const refund = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, type: "REFUND" },
    });
    expect(refund).toMatchObject({ status: "SUCCEEDED", providerId: "re_full", amount: 2000 });
  });

  it("marks PARTIALLY_REFUNDED without restocking on a partial refund", async () => {
    const { order, sessionId, product } = await cardOrder(5, 2); // total 2000, stock -> 3

    const result = await reconcileStripeRefund(sessionId, [{ id: "re_part", amount: 500 }]);

    // Not fully refunded -> no order returned for the buyer email.
    expect(result).toBeNull();
    const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
    expect(refreshed?.paymentStatus).toBe("PARTIALLY_REFUNDED");
    // We don't know which lines a manual partial refund covered -> no restock.
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(3);
  });

  it("skips refunds already recorded by the app (no double count)", async () => {
    const { order, sessionId } = await cardOrder(5, 2);
    // Simulate the app's own return refund already in the ledger.
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "re_known",
        amount: 2000,
        currency: "usd",
      },
    });

    const result = await reconcileStripeRefund(sessionId, [{ id: "re_known", amount: 2000 }]);

    expect(result).toBeNull();
    // Order untouched (still PAID) and no second refund row created.
    const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
    expect(refreshed?.paymentStatus).toBe("PAID");
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: "REFUND" } })).toBe(1);
  });
});

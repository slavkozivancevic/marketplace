import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getOrgOrderById } from "./orgOrders";
import { fulfillOrder } from "./orders";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

// fulfillOrder pulls in payments/db/payouts.ts (payout reversal on refund),
// which constructs a real Stripe client at import time - stub it so the
// (empty in test) API key doesn't throw. Not exercised by these tests.
vi.mock("@/services/stripe", () => ({
  stripe: { transfers: { create: vi.fn(), createReversal: vi.fn() } },
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

// Regression: getOrgOrderById used to mark a seller's PAYOUT row as fully
// "refunded" (struck through) the moment ANY external (Stripe dashboard)
// refund existed on the order, regardless of how much was actually refunded -
// same bug as getOrgPayoutsPage (see payouts.integration.test.ts), just a
// third independent copy of the same math, in the per-order page.
//
// The first case below then swung the other way and was corrected a second
// time. It used to expect a PARTIAL marking for a partial manual refund, on the
// reasoning that some of the payout was notionally gone. Nothing takes it:
// `reconcileStripeRefund` claws payouts back only on the crossing into
// REFUNDED, and then reverses the transfer whole. Marking the row while every
// cent of it still stood was a claim about the seller's money that no ledger
// entry backed - the page now says the refund happened, in words, and leaves
// the row alone.
describe("getOrgOrderById - external refund reversal display", () => {
  it("leaves the PAYOUT row alone for a partial external refund - nothing was reversed", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 10 });
    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${randomUUID()}`,
      totalCents: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
    });
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId: org.id,
        type: "PAYOUT",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "tr_mock_1",
        amount: 1800, // sellerNetAmount(2000)
        currency: "usd",
      },
    });
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId: null,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "re_manual_partial",
        amount: 1000, // half the order, refunded manually on Stripe
        currency: "usd",
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PARTIALLY_REFUNDED" },
    });

    const orgOrder = await getOrgOrderById(order.id, org.id);
    const payoutTx = orgOrder?.paymentTransactions.find((t) => t.type === "PAYOUT");

    expect(payoutTx?.refundState).toBe("none");
    expect(payoutTx?.reversedNet).toBe(0);
    // The refund itself is not hidden from the seller: the order-level REFUND
    // row is in their ledger, and the page states that it has not been taken
    // off their payout (`externalRefundPending` -> externalRefundNotDeductedNote).
    expect(orgOrder?.externalRefundGross).toBe(1000);
  });

  it("marks the PAYOUT row FULL only once the order is actually fully refunded", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 10 });
    const order = await fulfillOrder({
      userId: user.id,
      stripeSessionId: `cs_${randomUUID()}`,
      totalCents: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
    });
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId: org.id,
        type: "PAYOUT",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "tr_mock_2",
        amount: 1800,
        currency: "usd",
      },
    });
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId: null,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "re_manual_full",
        amount: 2000,
        currency: "usd",
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REFUNDED" },
    });

    const orgOrder = await getOrgOrderById(order.id, org.id);
    const payoutTx = orgOrder?.paymentTransactions.find((t) => t.type === "PAYOUT");

    expect(payoutTx?.refundState).toBe("full");
    expect(payoutTx?.reversedNet).toBe(payoutTx?.amount);
  });
});

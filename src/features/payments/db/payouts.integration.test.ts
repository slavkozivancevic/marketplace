import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { releaseSellerPayout, getOrgPayoutsPage } from "./payouts";
import { fulfillOrder } from "@/features/orders/db/orders";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createConnectedAccount,
} from "../../../../test/integration/helpers";

// releaseSellerPayout fires a best-effort SNS notification; stub the boundary so
// the DB-layer assertions stay deterministic and offline. The Stripe transfer is
// already skipped in test (MOCK_CONNECT is on outside production).
vi.mock("@/services/notifications", () => ({
  publishPayoutReleased: vi.fn().mockResolvedValue(undefined),
}));

// The Stripe client is constructed at module import from an (empty in test) API
// key; stub it so importing payouts.ts doesn't throw. Transfers are mocked out
// anyway via MOCK_CONNECT + the acct_mock_ account.
vi.mock("@/services/stripe", () => ({
  stripe: { transfers: { create: vi.fn() } },
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

// A paid card order with one seller line (price 1000 x qty) plus a per-seller
// shipping snapshot, so payout = sellerNet(subtotal) + orgShipping.
async function paidOrderForSeller(opts: { orgShipping?: number; qty?: number } = {}) {
  const qty = opts.qty ?? 2;
  const orgShipping = opts.orgShipping ?? 0;
  const user = await createUser();
  const org = await createOrganization();
  const product = await createProduct({ organizationId: org.id, price: 1000, stock: 10 });

  const order = await fulfillOrder({
    userId: user.id,
    stripeSessionId: `cs_${randomUUID()}`,
    totalCents: 1000 * qty + orgShipping,
    currency: "usd",
    exchangeRate: 1,
    items: [{ productId: product.id, variantId: null, quantity: qty }],
    shipping: SHIPPING,
    shippingTotal: orgShipping,
    shippingByOrg: orgShipping ? { [org.id]: orgShipping } : undefined,
  });

  return { order, org };
}

beforeEach(async () => {
  await resetDb();
});

describe("releaseSellerPayout", () => {
  it("transfers seller net (after 10% fee) plus their shipping and records a SUCCEEDED payout", async () => {
    const { order, org } = await paidOrderForSeller({ orgShipping: 200, qty: 2 });
    await createConnectedAccount({ organizationId: org.id, payoutsEnabled: true });

    await releaseSellerPayout({ orderId: order.id, organizationId: org.id });

    const payout = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, organizationId: org.id, type: "PAYOUT" },
    });
    // subtotal 2000 -> net 1800 (10% fee) + shipping 200 = 2000.
    expect(payout).toMatchObject({ status: "SUCCEEDED", provider: "STRIPE", amount: 2000 });
    expect(payout?.providerId).toMatch(/^tr_mock_/);
  });

  it("is idempotent - a second release does not create a second payout", async () => {
    const { order, org } = await paidOrderForSeller({ qty: 2 });
    await createConnectedAccount({ organizationId: org.id, payoutsEnabled: true });

    await releaseSellerPayout({ orderId: order.id, organizationId: org.id });
    await releaseSellerPayout({ orderId: order.id, organizationId: org.id });

    const count = await prisma.paymentTransaction.count({
      where: { orderId: order.id, organizationId: org.id, type: "PAYOUT" },
    });
    expect(count).toBe(1);
  });

  it("records a PENDING payout when the seller is not connected", async () => {
    const { order, org } = await paidOrderForSeller({ qty: 2 });
    // No ConnectedAccount created.

    await releaseSellerPayout({ orderId: order.id, organizationId: org.id });

    const payout = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, organizationId: org.id, type: "PAYOUT" },
    });
    expect(payout).toMatchObject({ status: "PENDING", amount: 1800 });
    expect(payout?.note).toBe("Seller not connected");
    expect(payout?.providerId).toBeNull();
  });
});

// Regression: a manual (Stripe dashboard) refund that covers only PART of the
// order used to make getOrgPayoutsPage show the seller's ENTIRE payout as
// refunded (struck through, "full" badge) just because an order-level refund
// row existed at all - it never checked how much was actually refunded.
// (35.000 RSD order, 15.000 RSD manual refund, but the whole 35.000 RSD
// payout showed as reversed.) computeReversedNet now nets/caps the partial
// case and only trusts "full" once Order.paymentStatus is actually REFUNDED.
describe("getOrgPayoutsPage - external refund reversal display", () => {
  it("shows PARTIAL (netted, capped) - not FULL - for a partial external refund", async () => {
    // subtotal 35000 -> seller payout net of 10% fee = 31500.
    const { order, org } = await paidOrderForSeller({ qty: 2, orgShipping: 0 });
    await createConnectedAccount({ organizationId: org.id, payoutsEnabled: true });
    await releaseSellerPayout({ orderId: order.id, organizationId: org.id });

    // Simulate reconcileStripeRefund's ledger write for a manual PARTIAL
    // refund, without going through the whole webhook/order flow.
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        organizationId: null,
        type: "REFUND",
        status: "SUCCEEDED",
        provider: "STRIPE",
        providerId: "re_manual_partial",
        amount: 1000, // 500 (half of qty=2 x price=1000) refunded gross
        currency: "usd",
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PARTIALLY_REFUNDED" },
    });

    const page = await getOrgPayoutsPage({ organizationId: org.id, take: 10 });
    const row = page.items.find((i) => i.orderId === order.id);

    expect(row?.refundState).toBe("partial");
    // netted: sellerNetAmount(1000) = 900, well under the 1800 payout.
    expect(row?.reversedNet).toBe(900);
    expect(row?.reversedNet).toBeLessThan(row?.amount ?? 0);
  });

  it("shows FULL only once the order is actually fully refunded", async () => {
    const { order, org } = await paidOrderForSeller({ qty: 2, orgShipping: 0 });
    await createConnectedAccount({ organizationId: org.id, payoutsEnabled: true });
    await releaseSellerPayout({ orderId: order.id, organizationId: org.id });

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

    const page = await getOrgPayoutsPage({ organizationId: org.id, take: 10 });
    const row = page.items.find((i) => i.orderId === order.id);

    expect(row?.refundState).toBe("full");
    expect(row?.reversedNet).toBe(row?.amount);
  });
});

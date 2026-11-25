import { describe, it, expect } from "vitest";
import { buildOrderDetailShape } from "./orderDetailShape";

type Input = Parameters<typeof buildOrderDetailShape>[0];
const at = (iso: string) => new Date(iso);
const DAY = 24 * 60 * 60 * 1000;

const line = (id: string, orgId: string, orgName: string, title: string) => ({
  id,
  quantity: 1,
  price: 1000,
  product: {
    translations: [{ locale: "en", title }],
    organizationId: orgId,
    organization: { name: orgName, returnWindowDays: 14 },
  },
  variant: null,
});

function input(over: {
  order?: Partial<Input["order"]>;
  parts?: Input["parts"];
  returns?: Input["returns"];
}): Input {
  return {
    order: {
      createdAt: at("2026-11-25T21:43:00Z"),
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      fulfillmentStatus: "UNFULFILLED",
      cancelledAt: null,
      currency: "usd",
      locale: "en",
      total: 2251,
      discountAmount: 0,
      couponCode: null,
      shippingTotal: 251,
      shippingName: "Test Buyer",
      shippingLine1: "Ulica Primera 12",
      shippingLine2: "",
      shippingCity: "Demograd",
      shippingState: null,
      shippingPostalCode: "00000",
      shippingCountry: "RS",
      items: [line("i1", "org-a", "Shop A", "Thermos Bottle 750ml"), line("i2", "org-b", "Shop B", "CSV dinar test")],
      ...over.order,
    },
    parts: over.parts ?? [
      { organizationId: "org-a", shippedAt: null, deliveredAt: null, cancelledAt: null, carrier: null, trackingNumber: null },
      { organizationId: "org-b", shippedAt: null, deliveredAt: null, cancelledAt: null, carrier: null, trackingNumber: null },
    ],
    returns: over.returns ?? [],
    externalRefunded: 0,
    hasActiveReturn: false,
  };
}

describe("buildOrderDetailShape", () => {
  it("draws an unpaid COD order: no invoice, a shipping row per seller, no returns card", () => {
    const shape = buildOrderDetailShape(input({}));

    expect(shape.stage).toBe("PENDING");
    expect(shape.invoiceable).toBe(false);
    expect(shape.sellers.map((s) => s.name)).toEqual(["Shop A", "Shop B"]);
    expect(shape.returnSellers).toBeNull();
    expect(shape.items.map((i) => i.title)).toEqual(["Thermos Bottle 750ml", "CSV dinar test"]);
  });

  it("opens the returns card once paid, explaining why a seller that has not delivered has no button", () => {
    const shape = buildOrderDetailShape(
      input({ order: { paymentMethod: "STRIPE", paymentStatus: "PAID", fulfillmentStatus: "UNFULFILLED" } }),
    );

    expect(shape.invoiceable).toBe(true);
    expect(shape.returnSellers?.map((s) => [s.name, s.button, s.hint])).toEqual([
      ["Shop A", false, "returnAfterDelivery"],
      ["Shop B", false, "returnAfterDelivery"],
    ]);
  });

  it("gives a delivered seller the button and the days left in its window", () => {
    const deliveredAt = new Date(Date.now() - 2 * DAY);
    const shape = buildOrderDetailShape(
      input({
        order: { paymentMethod: "STRIPE", paymentStatus: "PAID" },
        parts: [
          { organizationId: "org-a", shippedAt: deliveredAt, deliveredAt, cancelledAt: null, carrier: "DHL", trackingNumber: "1" },
          { organizationId: "org-b", shippedAt: null, deliveredAt: null, cancelledAt: null, carrier: null, trackingNumber: null },
        ],
      }),
    );

    const [a] = shape.returnSellers!;
    expect([a.button, a.hint, a.daysLeft]).toEqual([true, null, 12]);
    expect(shape.sellers[0]).toMatchObject({ carrier: "DHL", trackingNumber: "1" });
  });

  it("marks a withdrawn seller's lines cancelled and says why there is nothing to return", () => {
    const shape = buildOrderDetailShape(
      input({
        order: { paymentMethod: "STRIPE", paymentStatus: "PAID" },
        parts: [
          { organizationId: "org-a", shippedAt: null, deliveredAt: null, cancelledAt: at("2026-11-26T09:00:00Z"), carrier: null, trackingNumber: null },
          { organizationId: "org-b", shippedAt: null, deliveredAt: null, cancelledAt: null, carrier: null, trackingNumber: null },
        ],
      }),
    );

    expect(shape.items.map((i) => i.cancelled)).toEqual([true, false]);
    expect(shape.returnSellers?.[0].hint).toBe("sellerCancelledHint");
  });

  it("draws each existing return with its lines, and counts refunded ones toward the refunded total", () => {
    const shape = buildOrderDetailShape(
      input({
        order: { paymentMethod: "STRIPE", paymentStatus: "PARTIALLY_REFUNDED" },
        returns: [
          {
            organizationId: "org-a",
            status: "REFUNDED",
            reason: "Too small",
            resolutionNote: null,
            refundAmount: 900,
            items: [{ orderItemId: "i1", quantity: 1 }],
          },
        ],
      }),
    );

    const [a] = shape.returnSellers!;
    expect(a.returns).toEqual([
      { status: "REFUNDED", lines: [{ title: "Thermos Bottle 750ml", variantLabel: null, quantity: 1 }], reason: "Too small", resolutionNote: null },
    ]);
    // Everything from Shop A came back, so neither a button nor a hint.
    expect([a.button, a.hint]).toEqual([false, null]);
    expect(shape.buyerRefunded).toBe(900);
    expect(shape.partiallyRefunded).toBe(true);
  });
});

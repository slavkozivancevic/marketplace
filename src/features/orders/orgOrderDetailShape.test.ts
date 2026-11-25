import { describe, it, expect } from "vitest";
import { buildOrgOrderDetailShape } from "./orgOrderDetailShape";

const ORG = "org-me";
const OTHER = "org-other";
const at = (iso: string) => new Date(iso);

type Input = Parameters<typeof buildOrgOrderDetailShape>[0];

function input(over: {
  order?: Partial<Input["order"]>;
  part?: Partial<Input["part"]>;
  txns?: Input["txns"];
  canManage?: boolean;
  returnsCount?: number;
}): Input {
  return {
    order: {
      createdAt: at("2026-11-09T00:33:00Z"),
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      currency: "usd",
      locale: "en",
      discountAmount: 0,
      couponCode: null,
      shippingByOrg: null,
      user: { name: "Test Buyer" },
      shippingName: "Test Buyer",
      shippingLine1: "Ulica Primera 12",
      shippingLine2: null,
      shippingCity: "Demograd",
      shippingState: null,
      shippingPostalCode: "00000",
      shippingCountry: "RS",
      items: [{ variant: null }],
      ...over.order,
    },
    part: {
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      codSettledAt: null,
      itemsSubtotal: 1000,
      discountShare: 0,
      shippingAmount: 0,
      carrier: null,
      trackingNumber: null,
      ...over.part,
    },
    txns: over.txns ?? [],
    organizationId: ORG,
    orgSubtotal: 1000,
    hasActiveReturn: false,
    returnsCount: over.returnsCount ?? 0,
    canManage: over.canManage ?? true,
  };
}

const tx = (type: string, organizationId: string | null, amount: number, provider = "STRIPE") => ({
  type,
  status: "SUCCEEDED",
  provider,
  amount,
  currency: "usd",
  createdAt: at("2026-11-10T10:00:00Z"),
  organizationId,
});

describe("buildOrgOrderDetailShape", () => {
  it("draws a fresh COD order with the action card and the tracking form, no ledger", () => {
    const shape = buildOrgOrderDetailShape(input({}));

    expect(shape.stage).toBe("PENDING");
    expect(shape.action).toEqual({ paymentReceived: false, cancel: true });
    expect(shape.shipment).toEqual({ shippedAt: null, deliveredAt: null, carrier: null, trackingNumber: null });
    expect(shape.ledger).toEqual([]);
    expect(shape.isCod).toBe(true);
  });

  it("draws a delivered card order with its shipping details and only this seller's payout", () => {
    const shape = buildOrgOrderDetailShape(
      input({
        order: { paymentMethod: "STRIPE", paymentStatus: "PAID" },
        part: {
          shippedAt: at("2026-11-07T22:18:00Z"),
          deliveredAt: at("2026-11-07T22:19:00Z"),
          carrier: "DHL",
          trackingNumber: "123456",
        },
        // The CHARGE covers every seller and another seller's payout is its own
        // business - neither may reach this seller's ledger.
        txns: [tx("CHARGE", null, 2000), tx("PAYOUT", ORG, 900), tx("PAYOUT", OTHER, 800)],
      }),
    );

    expect(shape.stage).toBe("COMPLETED");
    expect(shape.action).toEqual({ paymentReceived: false, cancel: false });
    expect(shape.shipment).toMatchObject({ carrier: "DHL", trackingNumber: "123456" });
    expect(shape.ledger.map((r) => [r.type, r.amount])).toEqual([["PAYOUT", 900]]);
  });

  it("offers 'payment received' once a COD part is delivered, and drops the card once settled", () => {
    const delivered = input({ part: { shippedAt: at("2026-11-05T23:39:00Z"), deliveredAt: at("2026-11-05T23:40:00Z") } });
    expect(buildOrgOrderDetailShape(delivered).action).toEqual({ paymentReceived: true, cancel: true });

    const settled = buildOrgOrderDetailShape(
      input({
        part: {
          shippedAt: at("2026-11-05T23:39:00Z"),
          deliveredAt: at("2026-11-05T23:40:00Z"),
          codSettledAt: at("2026-11-05T23:41:00Z"),
        },
        txns: [tx("FEE", ORG, 100, "COD")],
      }),
    );
    expect(settled.action).toEqual({ paymentReceived: false, cancel: false });
    expect(settled.part.codSettled).toBe(true);
    expect(settled.ledger.map((r) => r.type)).toEqual(["FEE"]);
  });

  it("carries the coupon row only when the order is discounted", () => {
    expect(buildOrgOrderDetailShape(input({})).couponCode).toBeNull();
    const shape = buildOrgOrderDetailShape(
      input({ order: { discountAmount: 200, couponCode: "TEST20" }, part: { discountShare: 200 } }),
    );
    expect(shape.couponCode).toBe("TEST20");
    expect(shape.money.codCashToCollect).toBe(800);
  });

  it("leaves out the shipping card on a cancelled part, as the page does", () => {
    const shape = buildOrgOrderDetailShape(input({ part: { cancelledAt: at("2026-11-06T10:00:00Z") } }));

    expect(shape.isCancelled).toBe(true);
    expect(shape.shipment).toBeNull();
    expect(shape.action).toEqual({ paymentReceived: false, cancel: false });
  });

  it("draws no management cards for a read-only member", () => {
    const shape = buildOrgOrderDetailShape(input({ canManage: false, returnsCount: 2 }));

    expect(shape.canManage).toBe(false);
    expect(shape.action).toEqual({ paymentReceived: false, cancel: false });
    expect(shape.shipment).toBeNull();
    expect(shape.returnsCount).toBe(0);
  });

  it("reads this seller's delivery charge out of the per-seller split", () => {
    const shape = buildOrgOrderDetailShape(
      input({ order: { shippingByOrg: { [ORG]: 301, [OTHER]: 251 } }, part: { shippingAmount: 301 } }),
    );

    expect(shape.orgShipping).toBe(301);
    expect(shape.money.codCashToCollect).toBe(1301);
  });
});

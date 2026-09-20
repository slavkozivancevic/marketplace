import { describe, it, expect } from "vitest";
import { buildSellerParts } from "./db/sellerParts";
import {
  aggregateSellerParts,
  deriveSellerPartStage,
  deriveSellerPartStatus,
  sellerPartRefundState,
  type SellerPartAxes,
} from "./status";

const NOW = new Date("2026-09-12T10:00:00Z");

function part(over: Partial<SellerPartAxes> = {}): SellerPartAxes {
  return { shippedAt: null, deliveredAt: null, cancelledAt: null, codSettledAt: null, ...over };
}

describe("buildSellerParts", () => {
  it("groups lines by seller and sums each one's subtotal", () => {
    const parts = buildSellerParts({
      items: [
        { organizationId: "a", price: 1000, quantity: 2 },
        { organizationId: "b", price: 500, quantity: 1 },
        { organizationId: "a", price: 250, quantity: 4 },
      ],
      shippingByOrg: { a: 300, b: 700 },
      discountAmount: 0,
    });

    expect(parts).toHaveLength(2);
    const byOrg = new Map(parts.map((p) => [p.organizationId, p]));
    expect(byOrg.get("a")!.itemsSubtotal).toBe(3000);
    expect(byOrg.get("b")!.itemsSubtotal).toBe(500);
    expect(byOrg.get("a")!.shippingAmount).toBe(300);
    expect(byOrg.get("b")!.shippingAmount).toBe(700);
  });

  it("defaults shipping to zero for a seller with no shipping line", () => {
    const [only] = buildSellerParts({
      items: [{ organizationId: "a", price: 100, quantity: 1 }],
      shippingByOrg: null,
      discountAmount: 0,
    });
    expect(only.shippingAmount).toBe(0);
  });

  // The whole point of the pro-rata split: cancelling one part has to leave an
  // order total that is exactly right, so the shares can never lose a cent.
  it("splits the discount pro rata and always sums back to it exactly", () => {
    const parts = buildSellerParts({
      items: [
        { organizationId: "a", price: 1000, quantity: 1 },
        { organizationId: "b", price: 1000, quantity: 1 },
        { organizationId: "c", price: 1000, quantity: 1 },
      ],
      discountAmount: 100, // 100/3 does not divide evenly
    });

    expect(parts.reduce((s, p) => s + p.discountShare, 0)).toBe(100);
    // Floors are 33 each; the remainder of 1 goes to a single part.
    expect(parts.map((p) => p.discountShare).sort()).toEqual([33, 33, 34]);
  });

  it("gives the rounding remainder to the largest part, deterministically", () => {
    const parts = buildSellerParts({
      items: [
        { organizationId: "small", price: 100, quantity: 1 },
        { organizationId: "big", price: 900, quantity: 1 },
      ],
      discountAmount: 33,
    });

    const byOrg = new Map(parts.map((p) => [p.organizationId, p.discountShare]));
    // 33 * 900/1000 = 29.7 -> 29, 33 * 100/1000 = 3.3 -> 3, remainder 1 to "big".
    expect(byOrg.get("big")).toBe(30);
    expect(byOrg.get("small")).toBe(3);
    expect(byOrg.get("big")! + byOrg.get("small")!).toBe(33);
  });

  it("breaks ties on equal subtotals by organizationId, so the split is stable", () => {
    const first = buildSellerParts({
      items: [
        { organizationId: "zzz", price: 1000, quantity: 1 },
        { organizationId: "aaa", price: 1000, quantity: 1 },
      ],
      discountAmount: 5,
    });
    const second = buildSellerParts({
      items: [
        { organizationId: "aaa", price: 1000, quantity: 1 },
        { organizationId: "zzz", price: 1000, quantity: 1 },
      ],
      discountAmount: 5,
    });
    expect(first).toEqual(second);
    expect(first.find((p) => p.organizationId === "aaa")!.discountShare).toBe(3);
  });

  it("gives every part a zero share when there is no discount", () => {
    const parts = buildSellerParts({
      items: [
        { organizationId: "a", price: 1000, quantity: 1 },
        { organizationId: "b", price: 400, quantity: 1 },
      ],
      discountAmount: 0,
    });
    expect(parts.every((p) => p.discountShare === 0)).toBe(true);
  });
});

describe("deriveSellerPartStatus", () => {
  it("reads the stage off the timestamps", () => {
    expect(deriveSellerPartStatus(part())).toBe("PENDING");
    expect(deriveSellerPartStatus(part({ shippedAt: NOW }))).toBe("SHIPPED");
    expect(deriveSellerPartStatus(part({ shippedAt: NOW, deliveredAt: NOW }))).toBe("DELIVERED");
  });

  // A COD buyer can refuse the goods at the door, so cancelled has to win even
  // over a part that was already delivered.
  it("lets cancelled win over everything", () => {
    expect(
      deriveSellerPartStatus(part({ shippedAt: NOW, deliveredAt: NOW, cancelledAt: NOW })),
    ).toBe("CANCELLED");
  });
});

describe("aggregateSellerParts", () => {
  it("ignores cancelled parts when deciding the order is delivered", () => {
    const result = aggregateSellerParts([
      part({ shippedAt: NOW, deliveredAt: NOW }),
      part({ cancelledAt: NOW }),
    ]);
    // Without excluding the cancelled part this would stay FULFILLED forever,
    // and a COD order that never reaches DELIVERED can never be collected.
    expect(result.fulfillmentStatus).toBe("DELIVERED");
    expect(result.allCancelled).toBe(false);
  });

  it("still reports partial progress across active parts", () => {
    const result = aggregateSellerParts([
      part({ shippedAt: NOW }),
      part(),
      part({ cancelledAt: NOW }),
    ]);
    expect(result.fulfillmentStatus).toBe("PARTIALLY_FULFILLED");
  });

  it("reports the order cancelled only when no active part is left", () => {
    expect(aggregateSellerParts([part({ cancelledAt: NOW }), part()]).allCancelled).toBe(false);
    const all = aggregateSellerParts([part({ cancelledAt: NOW }), part({ cancelledAt: NOW })]);
    expect(all.allCancelled).toBe(true);
    // Null means "leave the goods axis alone" rather than recompute it from an
    // empty set and erase how far the order got.
    expect(all.fulfillmentStatus).toBeNull();
  });

  it("treats COD as settled only once every active part has paid", () => {
    expect(
      aggregateSellerParts([part({ codSettledAt: NOW }), part()]).codFullySettled,
    ).toBe(false);
    expect(
      aggregateSellerParts([part({ codSettledAt: NOW }), part({ codSettledAt: NOW })])
        .codFullySettled,
    ).toBe(true);
  });

  // A seller that withdrew must not hold the remaining sellers' cash hostage.
  it("does not wait on a cancelled part to settle COD", () => {
    const result = aggregateSellerParts([part({ codSettledAt: NOW }), part({ cancelledAt: NOW })]);
    expect(result.codFullySettled).toBe(true);
  });
});

/** Nothing of this seller's own goods has been refunded. */
const noRefund = { refundedGross: 0, itemsSubtotal: 1000 };

describe("deriveSellerPartStage", () => {
  it("pays a COD seller off its own settlement, not the order's", () => {
    const stage = deriveSellerPartStage({
      part: part({ shippedAt: NOW, deliveredAt: NOW, codSettledAt: NOW }),
      paymentMethod: "COD",
      orderPaymentStatus: "UNPAID", // another seller has not collected yet
      orgRefund: noRefund,
    });
    expect(stage).toBe("COMPLETED");
  });

  it("leaves a COD seller at delivered until it has collected", () => {
    const stage = deriveSellerPartStage({
      part: part({ shippedAt: NOW, deliveredAt: NOW }),
      paymentMethod: "COD",
      orderPaymentStatus: "UNPAID",
      orgRefund: noRefund,
    });
    expect(stage).toBe("DELIVERED");
  });

  it("uses the order's own axis for card orders", () => {
    const stage = deriveSellerPartStage({
      part: part(),
      paymentMethod: "STRIPE",
      orderPaymentStatus: "PAID",
      orgRefund: noRefund,
    });
    expect(stage).toBe("PROCESSING");
  });

  it("shows a seller its own cancellation while the order lives on", () => {
    const stage = deriveSellerPartStage({
      part: part({ cancelledAt: NOW }),
      paymentMethod: "COD",
      orderPaymentStatus: "UNPAID",
      orgRefund: noRefund,
    });
    expect(stage).toBe("CANCELLED");
  });

  it("reports a refunded order as refunded for every active seller", () => {
    const stage = deriveSellerPartStage({
      part: part({ shippedAt: NOW, deliveredAt: NOW }),
      paymentMethod: "STRIPE",
      orderPaymentStatus: "REFUNDED",
      orgRefund: noRefund,
    });
    expect(stage).toBe("REFUNDED");
  });
});
/**
 * A multi-seller order refunds one seller at a time, and the order's payment
 * axis is the sum of that - so it is the wrong thing to show any single seller.
 * These are the two readings it got wrong, in both directions.
 */
describe("a seller is shown its own refunds, never the order's", () => {
  const delivered = part({ shippedAt: NOW, deliveredAt: NOW, codSettledAt: NOW });

  it("says REFUNDED to the seller whose every unit came back", () => {
    // The order is only PARTIALLY_REFUNDED - another seller's goods are still
    // out there - but this seller has nothing left and earns nothing from it.
    const stage = deriveSellerPartStage({
      part: delivered,
      paymentMethod: "COD",
      orderPaymentStatus: "PARTIALLY_REFUNDED",
      orgRefund: { refundedGross: 1000, itemsSubtotal: 1000 },
    });
    expect(stage).toBe("REFUNDED");
  });

  it("says nothing of the sort to the seller who had no return at all", () => {
    // The dangerous half: this seller's row was marked "partially refunded"
    // purely because somebody ELSE's goods went back.
    const stage = deriveSellerPartStage({
      part: delivered,
      paymentMethod: "COD",
      orderPaymentStatus: "PARTIALLY_REFUNDED",
      orgRefund: { refundedGross: 0, itemsSubtotal: 1000 },
    });
    expect(stage).toBe("COMPLETED");
    expect(sellerPartRefundState({ refundedGross: 0, itemsSubtotal: 1000 }, "PARTIALLY_REFUNDED"))
      .toBe("none");
  });

  it("keeps a card seller paid when another seller's goods are refunded", () => {
    // Card money is captured for the whole order, so the axis flips to
    // PARTIALLY_REFUNDED for everyone. This seller is simply paid.
    const stage = deriveSellerPartStage({
      part: part({ shippedAt: NOW, deliveredAt: NOW }),
      paymentMethod: "STRIPE",
      orderPaymentStatus: "PARTIALLY_REFUNDED",
      orgRefund: { refundedGross: 0, itemsSubtotal: 1000 },
    });
    expect(stage).toBe("COMPLETED");
  });

  it("still refunds everyone when the whole order is written off", () => {
    // A full refund reverses every seller's transfer - including one made from
    // the Stripe dashboard, which carries no seller to attribute it to.
    expect(
      sellerPartRefundState({ refundedGross: 0, itemsSubtotal: 1000 }, "REFUNDED"),
    ).toBe("full");
  });

  it("calls a part partly refunded while some of its goods are still out", () => {
    expect(
      sellerPartRefundState({ refundedGross: 400, itemsSubtotal: 1000 }, "PARTIALLY_REFUNDED"),
    ).toBe("partial");
  });
});

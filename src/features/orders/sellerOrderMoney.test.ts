import { describe, it, expect } from "vitest";
import { sellerOrderMoney, type SellerOrderMoneyInput } from "./sellerOrderMoney";
import { codCommissionBack, couponSliceAt } from "./db/sellerParts";

/** A COD seller with 1000 of goods, a 300 delivery and a 100 coupon share. */
function input(over: Partial<SellerOrderMoneyInput> = {}): SellerOrderMoneyInput {
  return {
    isCod: true,
    isCancelled: false,
    isFullyRefunded: false,
    orgSubtotal: 1000,
    orgShipping: 300,
    partShipping: 300,
    part: { itemsSubtotal: 1000, discountShare: 100 },
    orgRefundGross: 0,
    externalRefundGross: 0,
    payoutTxAmount: null,
    ...over,
  };
}

describe("sellerOrderMoney - cash to collect", () => {
  it("is goods less this part's coupon share, plus its own delivery", () => {
    expect(sellerOrderMoney(input()).codCashToCollect).toBe(1200);
  });

  it("takes delivery from the part snapshot, not from the order's map", () => {
    // If the two ever disagree, the courier's figure must follow what the
    // buyer's order total was built from.
    const money = sellerOrderMoney(input({ orgShipping: 900, partShipping: 300 }));
    expect(money.codCashToCollect).toBe(1200);
  });
});

describe("sellerOrderMoney - what the seller owes on a COD order", () => {
  it("is the commission less the coupon the platform funds", () => {
    expect(sellerOrderMoney(input()).codOwed).toBe(0);
  });

  it("goes negative when the coupon runs deeper than the commission", () => {
    const money = sellerOrderMoney(input({ part: { itemsSubtotal: 1000, discountShare: 300 } }));
    expect(money.codOwed).toBe(-200);
  });

  it("shrinks by exactly what the refund credited back", () => {
    // Commission 100, coupon share 30, so 70 was accrued. Half the goods come
    // back: 50 of commission less the 15 of coupon riding on them, so 35.
    const money = sellerOrderMoney(
      input({ part: { itemsSubtotal: 1000, discountShare: 30 }, orgRefundGross: 500 }),
    );
    expect(money.codOwed).toBe(70);
    expect(money.codCommissionCredited).toBe(35);
    expect(money.codOwedAfterRefunds).toBe(35);
  });

  it("reaches nil once every unit is back", () => {
    const money = sellerOrderMoney(
      input({ part: { itemsSubtotal: 1000, discountShare: 30 }, orgRefundGross: 1000 }),
    );
    expect(money.codOwedAfterRefunds).toBe(0);
  });

  it("credits nothing on a card order - its commission was never accrued", () => {
    const money = sellerOrderMoney(input({ isCod: false, orgRefundGross: 500 }));
    expect(money.codCommissionCredited).toBe(0);
  });
});

describe("sellerOrderMoney - a seller that withdrew", () => {
  it("has nothing clawed back even when the ORDER is fully refunded", () => {
    // Reachable: one seller withdraws, the other delivers and collects, and the
    // buyer then returns all of the goods that were actually in the order. The
    // order reaches REFUNDED on those goods alone - it says nothing about the
    // seller that was never part of the money.
    const money = sellerOrderMoney(input({ isCancelled: true, isFullyRefunded: true }));
    expect(money.payoutReversed).toBe(0);
    expect(money.payoutReversedFromTransfer).toBe(0);
    expect(money.codDebtRestored).toBe(0);
  });

  it("is owed no commission and credited none", () => {
    const money = sellerOrderMoney(
      input({ isCancelled: true, isFullyRefunded: true, orgRefundGross: 0 }),
    );
    expect(money.codCommissionCredited).toBe(0);
  });
});

describe("sellerOrderMoney - a refund made outside the app", () => {
  it("takes nothing from the seller while the order is only partly refunded", () => {
    // Nothing reverses a partial dashboard refund: reconcileStripeRefund claws
    // payouts back only on the crossing into REFUNDED. Drawing a clawback for it
    // told the seller money had left when every cent of it was still theirs.
    const money = sellerOrderMoney(input({ isCod: false, externalRefundGross: 500 }));
    expect(money.payoutReversed).toBe(0);
    expect(money.finalTransferred).toBe(money.orgPayout);
  });

  it("says so, with the amount, instead of hiding it", () => {
    const money = sellerOrderMoney(input({ isCod: false, externalRefundGross: 500 }));
    expect(money.externalRefundPending).toBe(500);
  });

  it("stops flagging it once the order is written off, where the whole transfer goes", () => {
    const money = sellerOrderMoney(
      input({ isCod: false, externalRefundGross: 500, isFullyRefunded: true }),
    );
    expect(money.externalRefundPending).toBe(0);
    expect(money.payoutReversed).toBe(money.orgItemsNet);
  });

  it("flags nothing on a part the seller withdrew", () => {
    const money = sellerOrderMoney(
      input({ isCod: false, externalRefundGross: 500, isCancelled: true }),
    );
    expect(money.externalRefundPending).toBe(0);
  });
});

describe("sellerOrderMoney - clawback", () => {
  it("never takes the delivery, which is never refunded to the buyer", () => {
    const money = sellerOrderMoney(input({ isCod: false, isFullyRefunded: true }));
    expect(money.payoutReversed).toBe(money.orgItemsNet);
    expect(money.finalTransferred).toBe(300);
  });

  it("caps at what the (COD-netted) transfer actually moved", () => {
    // Payout owed 1200, but only 700 was transferred because 500 of old COD
    // debt was netted out of it. A full refund can reverse only those 700.
    const money = sellerOrderMoney(
      input({ isCod: false, isFullyRefunded: true, payoutTxAmount: 700 }),
    );
    expect(money.codNetted).toBe(500);
    expect(money.payoutReversedFromTransfer).toBe(700);
    expect(money.codDebtRestored).toBe(200);
    expect(money.finalTransferred).toBe(0);
  });
});

describe("couponSliceAt", () => {
  it("never hands back more coupon than the part ever carried", () => {
    expect(couponSliceAt(5000, { itemsSubtotal: 1000, discountShare: 100 })).toBe(100);
  });

  it("is nil for a part with no coupon", () => {
    expect(couponSliceAt(500, { itemsSubtotal: 1000, discountShare: 0 })).toBe(0);
    expect(couponSliceAt(500, null)).toBe(0);
  });
});

describe("codCommissionBack", () => {
  it("telescopes to what was accrued, however the units came back", () => {
    // Uneven on purpose: both halves round, so summing per-piece calls would
    // not land on the accrued figure.
    const part = { itemsSubtotal: 1005, discountShare: 101 };
    const accrued = 1005 - (1005 - Math.round((1005 * 10) / 100)) - 101;
    let running = 0;
    let credited = 0;
    for (const piece of [503, 1, 501]) {
      credited += codCommissionBack(running, piece, part);
      running += piece;
    }
    expect(credited).toBe(accrued);
  });
});

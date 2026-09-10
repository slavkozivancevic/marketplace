import { describe, it, expect, beforeEach } from "vitest";
import { validateCoupon, recordCouponUsage } from "./coupons";
import { prisma, resetDb, createCoupon } from "../../../../test/integration/helpers";

beforeEach(async () => {
  await resetDb();
});

/**
 * Every threshold and discount is now decided in the buyer's currency. These
 * cases run in USD, where the currency amount and the USD mirror coincide, so
 * they keep testing the coupon rules rather than the money conversion (that is
 * covered by money.test.ts). `usd(n)` spells out which number is which.
 */
const usd = (subtotal: number) => ({
  currency: "usd" as const,
  rates: { usd: 1 },
  subtotal,
});

describe("validateCoupon", () => {
  it("accepts an active coupon and computes the percent discount", async () => {
    const coupon = await createCoupon({ type: "PERCENT", value: 20 });

    const res = await validateCoupon(coupon.code, 10_000, null, usd(10_000));

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.discountUsd).toBe(2000);
      expect(res.discount).toBe(2000);
      expect(res.couponId).toBe(coupon.id);
    }
  });

  it("rejects an unknown code", async () => {
    const res = await validateCoupon("DOES-NOT-EXIST", 10_000, null, usd(10_000));
    expect(res).toEqual({ ok: false, reason: "notFound" });
  });

  it("rejects an inactive coupon", async () => {
    const coupon = await createCoupon({ value: 10, active: false });
    const res = await validateCoupon(coupon.code, 10_000, null, usd(10_000));
    expect(res).toEqual({ ok: false, reason: "notFound" });
  });

  it("rejects an expired coupon", async () => {
    const coupon = await createCoupon({ value: 10, expiresAt: new Date(Date.now() - 1000) });
    const res = await validateCoupon(coupon.code, 10_000, null, usd(10_000));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("rejects when the subtotal is below minOrder", async () => {
    const coupon = await createCoupon({ value: 10, minOrder: 5000 });
    const res = await validateCoupon(coupon.code, 4000, null, usd(4000));
    expect(res.ok).toBe(false);
    // The rejection reports the minimum in the currency it was judged in, so
    // the message the buyer sees cannot contradict the comparison.
    if (!res.ok) {
      expect(res.reason).toBe("minOrder");
      expect(res.minOrder).toBe(5000);
    }
  });

  it("rejects when the usage limit is already reached", async () => {
    const coupon = await createCoupon({ value: 10, usageLimit: 1, usageCount: 1 });
    const res = await validateCoupon(coupon.code, 10_000, null, usd(10_000));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("usedUp");
  });
});

describe("recordCouponUsage", () => {
  it("increments usage and never exceeds the limit", async () => {
    const coupon = await createCoupon({ value: 10, usageLimit: 2 });

    await recordCouponUsage(coupon.id);
    await recordCouponUsage(coupon.id);
    await recordCouponUsage(coupon.id); // capped - no-op

    const after = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    expect(after?.usageCount).toBe(2);
  });
});

import { describe, it, expect } from "vitest";
import {
  sellerNetAmount,
  platformFeeAmount,
  sellerNetSlice,
  platformFeeSlice,
} from "./config";

/**
 * The whole point of the slice helpers: goods come back a few units at a time,
 * and the pieces have to add up to what was charged once on the whole. Rounding
 * is what breaks that, so the cases below are chosen to round - a split at 5 in
 * a 10 total lands exactly on the half unit.
 */
const SPLITS: number[][] = [
  [5, 5],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [3, 7],
  [1999, 1999],
  [501, 501, 501],
  [1, 9998, 1],
];

describe("sellerNetSlice / platformFeeSlice", () => {
  it.each(SPLITS)("sums back to the figure on the whole (%s)", (...pieces) => {
    const total = pieces.reduce((s, p) => s + p, 0);
    let running = 0;
    let net = 0;
    let fee = 0;
    for (const piece of pieces) {
      net += sellerNetSlice(running, piece);
      fee += platformFeeSlice(running, piece);
      running += piece;
    }
    expect(net).toBe(sellerNetAmount(total));
    expect(fee).toBe(platformFeeAmount(total));
  });

  it("is what a per-piece call is NOT - the case this exists for", () => {
    // Two returns of 5: sliced they reverse 9 in total, the same as one return
    // of 10. Called on each piece on its own they reverse 4 + 4, and the seller
    // quietly keeps the odd unit.
    expect(sellerNetSlice(0, 5) + sellerNetSlice(5, 5)).toBe(sellerNetAmount(10));
    expect(sellerNetAmount(5) + sellerNetAmount(5)).not.toBe(sellerNetAmount(10));
  });

  it("keeps the two halves complementary at every step", () => {
    let running = 0;
    for (const piece of [7, 13, 1, 499]) {
      expect(sellerNetSlice(running, piece) + platformFeeSlice(running, piece)).toBe(piece);
      running += piece;
    }
  });
});

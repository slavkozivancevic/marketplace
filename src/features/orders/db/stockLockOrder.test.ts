import { describe, it, expect } from "vitest";
import { inStockLockOrder } from "./stockLockOrder";

const p = (productId: string) => ({ productId, variantId: null });
const v = (productId: string, variantId: string) => ({ productId, variantId });

describe("inStockLockOrder", () => {
  it("puts two carts with the same lines in opposite order into one order", () => {
    const cart = [p("pB"), v("pX", "vB"), p("pA"), v("pY", "vA")];
    const reversed = [...cart].reverse();

    expect(inStockLockOrder(cart)).toEqual(inStockLockOrder(reversed));
  });

  it("takes product rows before variant rows, each by id", () => {
    const sorted = inStockLockOrder([v("pA", "vA"), p("pZ"), v("pB", "vB"), p("pC")]);

    expect(sorted.map((l) => l.variantId ?? l.productId)).toEqual(["pC", "pZ", "vA", "vB"]);
  });

  it("keys a variant line by its variant, not its product", () => {
    // Two variants of one product are two rows; their product id says nothing
    // about which comes first.
    const sorted = inStockLockOrder([v("pA", "v2"), v("pA", "v1")]);

    expect(sorted.map((l) => l.variantId)).toEqual(["v1", "v2"]);
  });

  it("compares by code unit, independent of locale", () => {
    // localeCompare would put "a" before "B"; Postgres ids are compared here
    // only to agree with each other, so the plain order is the stable one.
    const sorted = inStockLockOrder([p("a"), p("B")]);

    expect(sorted.map((l) => l.productId)).toEqual(["B", "a"]);
  });

  it("leaves the caller's array in cart order", () => {
    const cart = [p("pB"), p("pA")];

    inStockLockOrder(cart);

    expect(cart.map((l) => l.productId)).toEqual(["pB", "pA"]);
  });

  it("treats an undefined variant as a product line", () => {
    const sorted = inStockLockOrder([{ productId: "pB" }, { productId: "pA", variantId: undefined }]);

    expect(sorted.map((l) => l.productId)).toEqual(["pA", "pB"]);
  });
});

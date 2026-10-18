import { describe, it, expect } from "vitest";
import { cardAvailability } from "./availability";

const simple = (stock: number | null) =>
  cardAvailability({ stock, variantCount: 0, hasVariantInStock: false });

const withVariants = (count: number, anyInStock: boolean) =>
  // A variant product's own column is null - that is the case this exists for.
  cardAvailability({ stock: null, variantCount: count, hasVariantInStock: anyInStock });

describe("cardAvailability", () => {
  it("reads a simple product's own column", () => {
    expect(simple(5)).toBe("in_stock");
    expect(simple(0)).toBe("out_of_stock");
  });

  it("stays silent when nobody tracked the stock", () => {
    expect(simple(null)).toBe("untracked");
  });

  it("answers for a variant product from its variants", () => {
    expect(withVariants(3, true)).toBe("in_stock");
    // The case that prompted this: every variant sold out, product column null.
    expect(withVariants(3, false)).toBe("out_of_stock");
  });

  it("never reports a variant product as untracked", () => {
    expect(withVariants(1, false)).not.toBe("untracked");
    expect(withVariants(9, true)).not.toBe("untracked");
  });

  it("ignores a stale column value when variants exist", () => {
    // A leftover number on a product that later gained variants must not
    // outvote the variants themselves.
    expect(
      cardAvailability({ stock: 99, variantCount: 2, hasVariantInStock: false }),
    ).toBe("out_of_stock");
  });
});

import { describe, it, expect } from "vitest";
import { firstInStockVariant } from "./defaultVariant";

const size = { id: "size", values: [{ value: "s" }, { value: "m" }, { value: "l" }] };
const color = { id: "color", values: [{ value: "black" }, { value: "white" }, { value: "blue" }] };

const v = (s: string, c: string, stock = 5) => ({
  id: `${s}-${c}`,
  stock,
  optionValues: [
    { optionId: "size", value: s },
    { optionId: "color", value: c },
  ],
});

describe("firstInStockVariant", () => {
  it("opens on the first pill of every axis, whatever the editor's row order", () => {
    // Blue was added first, so it leads the stored rows.
    const rows = [v("s", "blue"), v("m", "blue"), v("s", "white"), v("s", "black"), v("m", "black")];
    expect(firstInStockVariant([size, color], rows)?.id).toBe("s-black");
  });

  it("follows the axis order: the first axis decides before the second", () => {
    const rows = [v("m", "black"), v("s", "blue")];
    expect(firstInStockVariant([size, color], rows)?.id).toBe("s-blue");
  });

  it("skips what is sold out and takes the next in pill order", () => {
    const rows = [v("s", "blue"), v("s", "black", 0), v("s", "white")];
    expect(firstInStockVariant([size, color], rows)?.id).toBe("s-white");
  });

  it("returns nothing when every variant is sold out", () => {
    expect(firstInStockVariant([size, color], [v("s", "black", 0)])).toBeUndefined();
  });

  it("works with a single axis", () => {
    const one = (c: string) => ({ id: c, stock: 3, optionValues: [{ optionId: "color", value: c }] });
    expect(firstInStockVariant([color], [one("blue"), one("white"), one("black")])?.id).toBe("black");
  });
});

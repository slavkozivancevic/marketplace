import { describe, it, expect } from "vitest";
import { trustStripColumns } from "./stripColumns";

/** Rows the given count would occupy, and how many sit in the last one. */
const lastRow = (count: number) => {
  const cols = trustStripColumns(count);
  const rest = count % cols;
  return { cols, lastRow: rest === 0 ? cols : rest };
};

describe("trustStripColumns", () => {
  it("lets a small strip fill the width", () => {
    expect(trustStripColumns(1)).toBe(2);
    expect(trustStripColumns(2)).toBe(2);
    expect(trustStripColumns(3)).toBe(3);
    expect(trustStripColumns(4)).toBe(4);
  });

  it("never strands a single entry when another column count would not", () => {
    // 5 was the case that prompted this: four across, one stranded below.
    // A handful of counts (13, 25, ...) leave a remainder of one whichever
    // column count is used - 13 = 4*3+1 = 3*4+1 - so the claim is that the
    // choice is OPTIMAL, not that an orphan is always avoidable.
    const fullness = (n: number, cols: number) => (n % cols === 0 ? cols : n % cols);
    for (let n = 5; n <= 30; n++) {
      const chosen = trustStripColumns(n);
      const other = chosen === 4 ? 3 : 4;
      expect(fullness(n, chosen), `count ${n}`).toBeGreaterThanOrEqual(fullness(n, other));
    }
    // And for every count a storefront realistically shows, no orphan at all.
    for (let n = 3; n <= 12; n++) {
      expect(lastRow(n), `count ${n}`).not.toMatchObject({ lastRow: 1 });
    }
  });

  it("prefers the fullest last row", () => {
    expect(trustStripColumns(5)).toBe(3); // 3 + 2, not 4 + 1
    expect(trustStripColumns(6)).toBe(3); // 3 + 3
    expect(trustStripColumns(7)).toBe(4); // 4 + 3
    expect(trustStripColumns(8)).toBe(4); // 4 + 4
    expect(trustStripColumns(9)).toBe(3); // 3 + 3 + 3
    expect(trustStripColumns(12)).toBe(4); // both are full; four wins the tie
  });

  it("only ever answers with a column count the layout has a class for", () => {
    for (let n = 0; n <= 30; n++) {
      expect([2, 3, 4]).toContain(trustStripColumns(n));
    }
  });
});

import { describe, it, expect } from "vitest";
import { assertNotInUse } from "./assertNotInUse";
import { InUseError } from "../errors/domainErrors";

describe("assertNotInUse", () => {
  it("lets the delete through when nothing points at the record", () => {
    expect(() =>
      assertNotInUse([
        { count: 0, key: "categoryHasChildren" },
        { count: 0, key: "categoryHasProducts" },
      ]),
    ).not.toThrow();
  });

  it("throws an InUseError carrying the count for the toast", () => {
    let thrown: unknown;
    try {
      assertNotInUse([{ count: 4, key: "categoryHasChildren" }]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InUseError);
    expect((thrown as InUseError).i18n).toEqual({
      key: "categoryHasChildren",
      params: { count: 4 },
    });
  });

  it("reports the first blocker, so the most explanatory one is passed first", () => {
    // The real case: the "Toys & Kids" department had four subcategories AND
    // products underneath. "Move the subcategories" is the actionable half.
    let thrown: unknown;
    try {
      assertNotInUse([
        { count: 4, key: "categoryHasChildren" },
        { count: 12, key: "categoryHasProducts" },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect((thrown as InUseError).i18n.key).toBe("categoryHasChildren");
  });

  it("skips empty blockers and reports the one that is not empty", () => {
    let thrown: unknown;
    try {
      assertNotInUse([
        { count: 0, key: "categoryHasChildren" },
        { count: 12, key: "categoryHasProducts" },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect((thrown as InUseError).i18n).toEqual({
      key: "categoryHasProducts",
      params: { count: 12 },
    });
  });

  it("ignores a negative count rather than treating it as a blocker", () => {
    expect(() => assertNotInUse([{ count: -1, key: "brandInUse" }])).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { buildOptionSelection, normalizeOptionSelection } from "./optionSelection";

// Ids deliberately chosen so alphabetical order CONTRADICTS the admin's order:
// sorting by id would put L before M, and Bela before Crna.
const SIZE = {
  id: "zz-size",
  options: [{ id: "m-opt" }, { id: "l-opt" }], // admin order: M, then L
};
const COLOR = {
  id: "aa-color",
  options: [{ id: "crna-opt" }, { id: "bela-opt" }], // admin order: Crna, Bela
};
// Library order mirrors attribute order: Size first, Color second.
const LIBRARY = [SIZE, COLOR];

describe("normalizeOptionSelection", () => {
  it("keeps the admin's option order, not id order", () => {
    const out = normalizeOptionSelection({ [SIZE.id]: ["l-opt", "m-opt"] }, LIBRARY);
    expect(out[0].optionIds).toEqual(["m-opt", "l-opt"]);
  });

  it("keeps the admin's axis order, not id order", () => {
    const out = normalizeOptionSelection(
      { [COLOR.id]: ["crna-opt"], [SIZE.id]: ["m-opt"] },
      LIBRARY,
    );
    expect(out.map((e) => e.attributeId)).toEqual([SIZE.id, COLOR.id]);
  });

  it("normalizes identically no matter what order the user clicked in", () => {
    // Otherwise the dirty check would fire purely on ordering.
    const a = normalizeOptionSelection(
      { [SIZE.id]: ["m-opt", "l-opt"], [COLOR.id]: ["bela-opt", "crna-opt"] },
      LIBRARY,
    );
    const b = normalizeOptionSelection(
      { [COLOR.id]: ["crna-opt", "bela-opt"], [SIZE.id]: ["l-opt", "m-opt"] },
      LIBRARY,
    );
    expect(a).toEqual(b);
    expect(a[0].optionIds).toEqual(["m-opt", "l-opt"]);
    expect(a[1].optionIds).toEqual(["crna-opt", "bela-opt"]);
  });

  it("drops axes with nothing selected", () => {
    const out = normalizeOptionSelection(
      { [SIZE.id]: [], [COLOR.id]: ["crna-opt"] },
      LIBRARY,
    );
    expect(out).toEqual([{ attributeId: COLOR.id, optionIds: ["crna-opt"] }]);
  });

  it("puts ids missing from the library last, deterministically", () => {
    const out = normalizeOptionSelection(
      { [SIZE.id]: ["ghost-opt", "l-opt", "m-opt"] },
      LIBRARY,
    );
    expect(out[0].optionIds).toEqual(["m-opt", "l-opt", "ghost-opt"]);
  });

  it("handles an attribute missing from the library without throwing", () => {
    expect(normalizeOptionSelection({ "ghost-attr": ["x"] }, LIBRARY)).toEqual([
      { attributeId: "ghost-attr", optionIds: ["x"] },
    ]);
  });
});

describe("buildOptionSelection", () => {
  const variant = (pairs: [string, string][]) => ({
    attributeValues: pairs.map(([attributeId, optionId]) => ({ attributeId, optionId })),
  });

  it("derives the selection from saved variants in admin order", () => {
    // Variants deliberately listed L-first to prove the row order doesn't leak.
    const out = buildOptionSelection(
      [
        variant([
          [SIZE.id, "l-opt"],
          [COLOR.id, "bela-opt"],
        ]),
        variant([
          [SIZE.id, "m-opt"],
          [COLOR.id, "crna-opt"],
        ]),
      ],
      LIBRARY,
    );
    expect(out).toEqual([
      { attributeId: SIZE.id, optionIds: ["m-opt", "l-opt"] },
      { attributeId: COLOR.id, optionIds: ["crna-opt", "bela-opt"] },
    ]);
  });

  it("de-duplicates options shared across variants", () => {
    const out = buildOptionSelection(
      [variant([[SIZE.id, "m-opt"]]), variant([[SIZE.id, "m-opt"]])],
      LIBRARY,
    );
    expect(out).toEqual([{ attributeId: SIZE.id, optionIds: ["m-opt"] }]);
  });

  it("returns an empty selection for a product without variants", () => {
    expect(buildOptionSelection([], LIBRARY)).toEqual([]);
  });

  it("round-trips: a derived baseline equals the normalized live selection", () => {
    // This equality is what keeps the save bar quiet on an untouched form.
    const derived = buildOptionSelection(
      [
        variant([
          [SIZE.id, "m-opt"],
          [COLOR.id, "crna-opt"],
        ]),
        variant([
          [SIZE.id, "l-opt"],
          [COLOR.id, "bela-opt"],
        ]),
      ],
      LIBRARY,
    );
    const live = normalizeOptionSelection(
      { [SIZE.id]: ["l-opt", "m-opt"], [COLOR.id]: ["bela-opt", "crna-opt"] },
      LIBRARY,
    );
    expect(derived).toEqual(live);
  });
});

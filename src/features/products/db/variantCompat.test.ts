import { describe, it, expect } from "vitest";
import { buildCompatOptions } from "./variantCompat";

type Label = { locale: string; label: string };
type Attr = { id: string; key: string; order: number; translations: Label[] };
type Opt = { id: string; value: string; order: number; translations: Label[] };

// Variant rows are stored in creation order, which for seeded and
// script-written products is an arbitrary permutation of the configured
// options. These fixtures deliberately store them "wrong" (XL before M, blue
// before black) so a regression back to encounter order fails here.
const SIZE: Attr = { id: "size", key: "clothing-size", order: 2, translations: [] };
const COLOR: Attr = { id: "color", key: "color", order: 5, translations: [] };
const sizeOpt: Record<string, Opt> = {
  m: { id: "o-m", value: "m", order: 2, translations: [] },
  l: { id: "o-l", value: "l", order: 3, translations: [] },
  xl: { id: "o-xl", value: "xl", order: 4, translations: [] },
};
const colorOpt: Record<string, Opt> = {
  black: { id: "o-black", value: "black", order: 0, translations: [] },
  red: { id: "o-red", value: "red", order: 2, translations: [] },
  blue: { id: "o-blue", value: "blue", order: 3, translations: [] },
};

type Axis = { attribute: Attr; option: Opt };
const variant = (axes: Axis[]) =>
  ({
    attributeValues: axes.map((a, i) => ({
      id: `av-${a.option.id}-${i}`,
      attributeId: a.attribute.id,
      attribute: a.attribute,
      option: a.option,
    })),
  }) as unknown as Parameters<typeof buildCompatOptions>[0][number];

const valuesOf = (opts: ReturnType<typeof buildCompatOptions>, attrId: string) =>
  opts.find((o) => o.id === attrId)?.values.map((v) => v.value);

describe("buildCompatOptions", () => {
  it("orders chips by AttributeOption.order, not by variant storage order", () => {
    const opts = buildCompatOptions([
      variant([{ attribute: SIZE, option: sizeOpt.xl }, { attribute: COLOR, option: colorOpt.blue }]),
      variant([{ attribute: SIZE, option: sizeOpt.xl }, { attribute: COLOR, option: colorOpt.red }]),
      variant([{ attribute: SIZE, option: sizeOpt.l }, { attribute: COLOR, option: colorOpt.black }]),
      variant([{ attribute: SIZE, option: sizeOpt.m }, { attribute: COLOR, option: colorOpt.blue }]),
    ]);

    expect(valuesOf(opts, "size")).toEqual(["m", "l", "xl"]);
    expect(valuesOf(opts, "color")).toEqual(["black", "red", "blue"]);
  });

  it("orders axes by Attribute.order, not by the order they are encountered", () => {
    // Colour is seen first on every variant, but Size has the lower
    // `Attribute.order` and must render first.
    const opts = buildCompatOptions([
      variant([{ attribute: COLOR, option: colorOpt.red }, { attribute: SIZE, option: sizeOpt.l }]),
      variant([{ attribute: COLOR, option: colorOpt.black }, { attribute: SIZE, option: sizeOpt.m }]),
    ]);

    expect(opts.map((o) => o.id)).toEqual(["size", "color"]);
  });

  it("breaks ties on equal order deterministically", () => {
    // Legacy rows written before `order` was populated all share 0.
    const zeta: Opt = { id: "o-z", value: "zeta", order: 0, translations: [] };
    const alpha: Opt = { id: "o-a", value: "alpha", order: 0, translations: [] };
    const opts = buildCompatOptions([
      variant([{ attribute: SIZE, option: zeta }]),
      variant([{ attribute: SIZE, option: alpha }]),
    ]);

    expect(valuesOf(opts, "size")).toEqual(["alpha", "zeta"]);
  });

  it("keys each locale's label map off the sorted values", () => {
    const color: Attr = { ...COLOR, translations: [{ locale: "sr", label: "Boja" }] };
    const crna: Opt = { id: "o-black", value: "black", order: 0, translations: [{ locale: "sr", label: "Crna" }] };
    const plava: Opt = { id: "o-blue", value: "blue", order: 3, translations: [{ locale: "sr", label: "Plava" }] };
    const opts = buildCompatOptions([
      variant([{ attribute: color, option: plava }]),
      variant([{ attribute: color, option: crna }]),
    ]);

    const sr = opts[0].translations.find((t) => t.locale === "sr");
    expect(sr?.name).toBe("Boja");
    expect(Object.keys(sr!.values)).toEqual(["black", "blue"]);
  });
});

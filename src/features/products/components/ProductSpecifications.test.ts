import { describe, it, expect } from "vitest";
import {
  buildAttributeSpecRows,
  type AttributeValueForSpec,
} from "./ProductSpecifications";

const t = (key: string) => key;

const MATERIAL: AttributeValueForSpec["attribute"] = {
  key: "material",
  type: "MULTI_SELECT",
  unit: null,
  order: 6,
  translations: [{ locale: "sr", label: "Materijal" }],
};

const option = (order: number, label: string): AttributeValueForSpec["option"] => ({
  order,
  translations: [{ locale: "sr", label }],
});

const row = (
  attribute: AttributeValueForSpec["attribute"],
  opt: AttributeValueForSpec["option"],
): AttributeValueForSpec => ({
  attributeId: attribute.key,
  valueNumeric: null,
  valueBool: null,
  attribute,
  option: opt,
});

describe("buildAttributeSpecRows", () => {
  it("joins MULTI_SELECT labels in AttributeOption.order, not row order", () => {
    // Rows arrive in the order the seller ticked the boxes.
    const rows = buildAttributeSpecRows(
      [
        row(MATERIAL, option(1, "Poliester")),
        row(MATERIAL, option(0, "Pamuk")),
        row(MATERIAL, option(2, "Koža")),
      ],
      "sr",
      t,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe("Pamuk, Poliester, Koža");
  });

  it("breaks ties on equal order deterministically", () => {
    // Legacy rows written before `order` was populated all share 0.
    const rows = buildAttributeSpecRows(
      [row(MATERIAL, option(0, "Vuna")), row(MATERIAL, option(0, "Pamuk"))],
      "sr",
      t,
    );

    expect(rows[0].value).toBe("Pamuk, Vuna");
  });

  it("still orders the rows themselves by Attribute.order", () => {
    const color: AttributeValueForSpec["attribute"] = {
      key: "color",
      type: "SELECT",
      unit: null,
      order: 5,
      translations: [{ locale: "sr", label: "Boja" }],
    };
    const rows = buildAttributeSpecRows(
      [row(MATERIAL, option(0, "Pamuk")), row(color, option(0, "Crna"))],
      "sr",
      t,
    );

    expect(rows.map((r) => r.label)).toEqual(["Boja", "Materijal"]);
  });
});

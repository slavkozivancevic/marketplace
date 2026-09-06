"use client";

import { cn } from "@/lib/utils";
import { getLabel } from "@/features/attributes/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import { countryName } from "@/lib/i18n/countries";
import type { SerializedPublicProduct } from "@/types/types";

export type SpecRow = { key: string; label: string; value: string };

/**
 * The shape both the public and the admin include produce for a product's
 * attribute values. Declared structurally so one formatter serves both without
 * either payload type leaking into the other.
 */
export type AttributeValueForSpec = {
  attributeId: string;
  valueNumeric: number | null;
  valueBool: boolean | null;
  attribute: {
    key: string;
    type: string;
    unit: string | null;
    order: number;
    translations: { locale: string; label: string }[];
  };
  option: { order: number; translations: { locale: string; label: string }[] } | null;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Builds the specification rows for a product, shared by the product page and
 * the quick view so both show the same facts in the same order.
 *
 * Two sources, in this order:
 *   1. Structured columns the platform owns (brand, warranty, origin, weight,
 *      dimensions) - fixed rows, fixed order.
 *   2. The product's attribute values, ordered by `Attribute.order`. WHICH
 *      attributes a product can carry is decided per category by the platform
 *      admin (CategoryAttribute); the seller only fills in values. That is what
 *      keeps two products in one category comparable.
 *
 * A row with no value is never emitted - an empty table row reads as broken
 * data, and "unspecified" is not a fact worth a line.
 */
export function buildSpecRows(
  product: SerializedPublicProduct,
  locale: string,
  t: Translate,
): SpecRow[] {
  const rows: SpecRow[] = [];

  if (product.brand) {
    const name = getBrandName(product.brand, locale);
    if (name) rows.push({ key: "brand", label: t("specBrand"), value: name });
  }

  if (product.warrantyMonths != null) {
    rows.push({
      key: "warranty",
      label: t("warranty"),
      // 0 is a deliberate "no warranty", not a blank.
      value:
        product.warrantyMonths === 0
          ? t("noWarranty")
          : t("warrantyValue", { count: product.warrantyMonths }),
    });
  }

  if (product.countryOfOrigin) {
    rows.push({
      key: "origin",
      label: t("countryOfOrigin"),
      value: countryName(product.countryOfOrigin, locale),
    });
  }

  if (product.weight != null) {
    rows.push({
      key: "weight",
      label: t("specWeight"),
      value: `${product.weight}${product.weightUnit ? ` ${product.weightUnit.toLowerCase()}` : ""}`,
    });
  }

  const dims = [product.length, product.width, product.height];
  if (dims.some((d) => d != null)) {
    const unit = product.dimensionUnit ? ` ${product.dimensionUnit.toLowerCase()}` : "";
    rows.push({
      key: "dimensions",
      label: t("specDimensions"),
      value: `${dims.map((d) => (d != null ? String(d) : "-")).join(" x ")}${unit}`,
    });
  }

  return [...rows, ...buildAttributeSpecRows(product.attributeValues, locale, t)];
}

/** The attribute half of the spec table, shared with the admin detail view. */
export function buildAttributeSpecRows(
  values: readonly AttributeValueForSpec[],
  locale: string,
  t: Translate,
): SpecRow[] {
  // MULTI_SELECT stores one row per selected option, so values are grouped by
  // attribute and their labels joined into a single line. `order` rides along
  // per option: the rows arrive in insertion order, which is the order the
  // seller happened to tick the boxes, so joining them as they come renders
  // "Poliester, Pamuk" for a library configured as Pamuk then Poliester.
  const grouped = new Map<
    string,
    {
      attribute: AttributeValueForSpec["attribute"];
      options: { order: number; label: string }[];
      valueNumeric: number | null;
      valueBool: boolean | null;
    }
  >();

  for (const av of values) {
    let entry = grouped.get(av.attributeId);
    if (!entry) {
      entry = {
        attribute: av.attribute,
        options: [],
        valueNumeric: null,
        valueBool: null,
      };
      grouped.set(av.attributeId, entry);
    }
    if (av.option) {
      entry.options.push({
        order: av.option.order,
        label: getLabel(av.option.translations, locale),
      });
    }
    if (av.valueNumeric != null) entry.valueNumeric = av.valueNumeric;
    if (av.valueBool != null) entry.valueBool = av.valueBool;
  }

  return [...grouped.values()]
    .sort((a, b) => a.attribute.order - b.attribute.order)
    .flatMap(({ attribute, options, valueNumeric, valueBool }) => {
      let value: string | null = null;
      if (attribute.type === "SELECT" || attribute.type === "MULTI_SELECT") {
        // `label` breaks ties so legacy rows sharing `order` 0 stay stable.
        value =
          [...options]
            .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
            .map((o) => o.label)
            .filter(Boolean)
            .join(", ") || null;
      } else if (attribute.type === "RANGE") {
        value =
          valueNumeric != null
            ? `${valueNumeric}${attribute.unit ? ` ${attribute.unit}` : ""}`
            : null;
      } else if (attribute.type === "BOOLEAN") {
        value = valueBool == null ? null : valueBool ? t("yes") : t("no");
      }
      if (!value) return [];
      return [
        {
          key: `attr:${attribute.key}`,
          label: getLabel(attribute.translations, locale),
          value,
        },
      ];
    });
}

/**
 * Two-column specification list. No trailing colons on labels - the columns
 * are what separate label from value, and a colon inside a table column reads
 * as a typo rather than punctuation.
 */
export function ProductSpecifications({
  rows,
  limit,
  dense = false,
  className,
}: {
  rows: SpecRow[];
  /** Renders only the first N rows (the quick view's key-facts block). */
  limit?: number;
  /** Tighter rows and a narrower label column, for the quick view popup. */
  dense?: boolean;
  className?: string;
}) {
  const visible = limit != null ? rows.slice(0, limit) : rows;
  if (visible.length === 0) return null;

  return (
    <dl className={cn("divide-y divide-border/60 text-sm", className)}>
      {visible.map((row) => (
        <div
          key={row.key}
          className={cn(
            "grid gap-4",
            dense
              ? "grid-cols-[minmax(0,7rem)_minmax(0,1fr)] py-1"
              : "grid-cols-[minmax(0,11rem)_minmax(0,1fr)] py-2",
          )}
        >
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-medium wrap-break-word">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

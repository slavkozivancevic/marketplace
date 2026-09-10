import type { MoneySet } from "@/lib/money";
import type { MoneyInput } from "@/lib/money-input";
/**
 * Shared types for filter-based bulk operations.
 * Kept in a standalone file (no "use server" / "use client") so they can be
 * safely imported by both server actions and client components without
 * triggering Turbopack's server-action re-export bug.
 */

/**
 * Hard ceiling for how many products a single filter-driven bulk category
 * mutation may touch. Category writes rebuild each product's denormalized search
 * text (an N+1 inside the transaction), so a broad filter could otherwise open a
 * long-running, lock-heavy transaction. The server enforces this; the panel
 * surfaces it as an upfront warning. Lives here (no "use server"/"use client")
 * so both sides share one source of truth.
 */
export const BULK_CATEGORY_MUTATION_LIMIT = 500;

export type BulkFilter = {
  /** Product brand must be one of these IDs. */
  brandId?: string[];
  /** Only products that have NO brand assigned. */
  noBrand?: boolean;
  /** Product must belong to at least one of these category IDs. */
  categoryId?: string[];
  /** Only products that have NO category assigned. */
  noCategory?: boolean;
  /** Product must carry at least one of these tag IDs. */
  tagId?: string[];
  /** Only products that have NO tag assigned. */
  noTag?: boolean;
  /** Product status must be one of these values. */
  status?: string[];
  /** Price bounds, in USD cents against the indexed mirror column. Bounds are
   *  a search range, not a price: a dinar of slack at the edge is harmless, so
   *  these stay a plain converted number rather than a MoneySet. */
  minPrice?: number;
  maxPrice?: number;
  /** Inventory bounds. */
  minStock?: number;
  maxStock?: number;
  /** Products with stock === 0 (excludes null = "untracked"). */
  outOfStock?: boolean;
  /** Boolean flag filters. */
  taxable?: boolean;
  requiresShipping?: boolean;
  isDigital?: boolean;
  /** Origin must be one of these ISO 3166-1 alpha-2 codes. */
  countryOfOrigin?: string[];
  /** Only products with no origin recorded. */
  noCountryOfOrigin?: boolean;
  /**
   * Only products with no warranty recorded. Distinct from `warrantyMonths: 0`,
   * which is a deliberate "no warranty" - this is the missing-data sweep.
   */
  noWarranty?: boolean;
  /** Warranty bounds, in months. */
  minWarrantyMonths?: number;
  maxWarrantyMonths?: number;
  /** Case-insensitive substring match on title. */
  titleContains?: string;
};

export type BulkCategoryUpdate = {
  /**
   * - "set": replace all categories with `ids`
   * - "add": append `ids` to existing categories (skip duplicates)
   * - "remove": detach `ids` from existing categories
   */
  mode: "set" | "add" | "remove";
  ids: string[];
};

export type BulkTagUpdate = {
  /**
   * - "set": replace all tags with `ids`
   * - "add": append `ids` to existing tags (skip duplicates)
   * - "remove": detach `ids` from existing tags
   */
  mode: "set" | "add" | "remove";
  ids: string[];
};

export type BulkUpdateFields = {
  status?: string;
  /** Pass null to remove the brand assignment. */
  brandId?: string | null;
  /** Prices set on every matched product. MoneyInput on the way in from the
   *  panel, resolved to a MoneySet by the action before it reaches the repo. */
  price?: MoneyInput;
  compareAtPrice?: MoneyInput | null;
  costPrice?: MoneyInput | null;
  taxable?: boolean;
  requiresShipping?: boolean;
  isDigital?: boolean;
  /** Months of warranty, or null to clear it back to "unspecified". */
  warrantyMonths?: number | null;
  /** ISO 3166-1 alpha-2 code, or null to clear it. */
  countryOfOrigin?: string | null;
  /** Absolute stock value, or null to mark "untracked". */
  stock?: number | null;
  /** Category set / add / remove operation. */
  categories?: BulkCategoryUpdate;
  /** Tag set / add / remove operation. */
  tags?: BulkTagUpdate;
};

/**
 * What the repository actually writes. The panel sends MoneyInputs; the action
 * resolves them into MoneySets with server-read rates before they get anywhere
 * near a column, so the repo never has to know about exchange rates.
 */
export type BulkUpdateResolved = Omit<
  BulkUpdateFields,
  "price" | "compareAtPrice" | "costPrice"
> & {
  price?: MoneySet;
  compareAtPrice?: MoneySet | null;
  costPrice?: MoneySet | null;
};

export type PreviewResult = {
  count: number;
  samples: {
    id: string;
    title: string;
    /** USD-cent mirror plus the stored set, so the preview can show the price
     *  in the currency the operator is browsing in. */
    price: number;
    priceMoney: MoneySet | null;
    status: string;
    brand: { name: string } | null;
  }[];
};
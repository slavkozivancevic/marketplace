/**
 * Shared types for filter-based bulk operations.
 * Kept in a standalone file (no "use server" / "use client") so they can be
 * safely imported by both server actions and client components without
 * triggering Turbopack's server-action re-export bug.
 */

export type BulkFilter = {
  /** Product brand must be one of these IDs. */
  brandId?: string[];
  /** Only products that have NO brand assigned. */
  noBrand?: boolean;
  /** Product must belong to at least one of these category IDs. */
  categoryId?: string[];
  /** Only products that have NO category assigned. */
  noCategory?: boolean;
  /** Product status must be one of these values. */
  status?: string[];
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

export type BulkUpdateFields = {
  status?: string;
  /** Pass null to remove the brand assignment. */
  brandId?: string | null;
  price?: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  taxable?: boolean;
  requiresShipping?: boolean;
  isDigital?: boolean;
  /** Absolute stock value, or null to mark "untracked". */
  stock?: number | null;
  /** Category set / add / remove operation. */
  categories?: BulkCategoryUpdate;
};

export type PreviewResult = {
  count: number;
  samples: {
    id: string;
    title: string;
    price: number;
    status: string;
    brand: { name: string } | null;
  }[];
};
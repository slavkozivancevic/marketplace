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
  /** Product status must be one of these values. */
  status?: string[];
  minPrice?: number;
  maxPrice?: number;
  /** Case-insensitive substring match on title. */
  titleContains?: string;
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
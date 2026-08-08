/** Number of items per page for grid layouts (products grid). */
export const GRID_PAGE_SIZE = 12;

/** Number of items per page for list/table layouts (orders, admin products). */
export const LIST_PAGE_SIZE = 50;

/** Max pages kept in TanStack Query infinite cache before oldest are evicted. */
export const MAX_PAGES = 5;

/**
 * Bestseller badge tuning (`/api/internal/recompute-bestsellers`). A product
 * is flagged when it's among the top `BESTSELLER_TOP_N` sellers (by units,
 * `PAID`/`PARTIALLY_REFUNDED` orders only) within at least one of its
 * categories over the trailing `BESTSELLER_WINDOW_DAYS`, provided it cleared
 * `BESTSELLER_MIN_UNITS` - keeps a single early sale in a sparse category
 * from earning the badge.
 */
export const BESTSELLER_WINDOW_DAYS = 90;
export const BESTSELLER_MIN_UNITS = 3;
export const BESTSELLER_TOP_N = 3;

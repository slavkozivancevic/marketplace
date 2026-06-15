import {
  parseAsString,
  parseAsStringEnum,
  parseAsFloat,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
} from "nuqs/server";

// ---------- Public products ----------

// Note: "title" sort was removed when title moved to ProductTranslation.
// Sorting by a per-locale field across cursor-paginated pages requires either
// a denormalized column or post-fetch sort - both add complexity for an
// admin-only convenience. UI can sort the current page client-side if needed.
export const productSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "avgRating"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  minPrice: parseAsFloat,
  maxPrice: parseAsFloat,
  onSale: parseAsBoolean,
  isDigital: parseAsBoolean,
  brandId: parseAsArrayOf(parseAsString).withDefault([]),
  minRating: parseAsInteger,
  // dept = slug of the selected department/category (any level).
  // "" means "All Departments". The API resolves this to the full
  // descendant ID set before querying the DB.
  dept: parseAsString.withDefault(""),
  // Catalog attribute facet selections, encoded as a single compact string
  // (see lib/query/attrs.ts). Kept as one param so the schema stays static.
  attrs: parseAsString.withDefault(""),
};

export type ProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "avgRating";
  sortOrder: "asc" | "desc";
  minPrice: number | null;
  maxPrice: number | null;
  onSale: boolean | null;
  isDigital: boolean | null;
  brandId: string[];
  minRating: number | null;
  dept: string;
  attrs: string;
};

// ---------- Admin products ----------

export const adminProductSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "status"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  minPrice: parseAsFloat,
  maxPrice: parseAsFloat,
  brandId: parseAsArrayOf(parseAsString).withDefault([]),
};

export type AdminProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "status";
  sortOrder: "asc" | "desc";
  status: string[];
  minPrice: number | null;
  maxPrice: number | null;
  brandId: string[];
};

// ---------- My products (seller dashboard) ----------

export const myProductSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "status"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  minPrice: parseAsFloat,
  maxPrice: parseAsFloat,
  brandId: parseAsArrayOf(parseAsString).withDefault([]),
};

export type MyProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "status";
  sortOrder: "asc" | "desc";
  status: string[];
  minPrice: number | null;
  maxPrice: number | null;
  brandId: string[];
};

// ---------- Orders ----------

export const orderSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "total"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
};

export type OrderFilters = {
  search: string;
  sortBy: "createdAt" | "total";
  sortOrder: "asc" | "desc";
  status: string[];
};

// ---------- Admin users ----------

export const adminUserSearchParams = {
  search: parseAsString.withDefault(""),
  role: parseAsArrayOf(parseAsString).withDefault([]),
};

export type AdminUserFilters = {
  search: string;
  role: string[];
};

// ---------- Org (seller) received orders ----------

export const orgOrderSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "total"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
};

export type OrgOrderFilters = {
  search: string;
  sortBy: "createdAt" | "total";
  sortOrder: "asc" | "desc";
  status: string[];
};

// ---------- Org (seller) payouts ----------

export const orgPayoutSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "amount"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  // Derived facet: "refunded" / "active". Empty or both selected = no filter.
  refunded: parseAsArrayOf(parseAsString).withDefault([]),
};

export type OrgPayoutFilters = {
  search: string;
  sortBy: "createdAt" | "amount";
  sortOrder: "asc" | "desc";
  status: string[];
  refunded: string[];
};

// ---------- Admin organizations ----------

export const adminOrgSearchParams = {
  search: parseAsString.withDefault(""),
  verified: parseAsStringEnum(["true", "false", ""] as const).withDefault(""),
};

export type AdminOrgFilters = {
  search: string;
  verified: string;
};
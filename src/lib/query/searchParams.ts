import {
  parseAsString,
  parseAsStringEnum,
  parseAsFloat,
  parseAsArrayOf,
  parseAsBoolean,
} from "nuqs/server";

// ---------- Public products ----------

export const productSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "title", "avgRating"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  minPrice: parseAsFloat,
  maxPrice: parseAsFloat,
  onSale: parseAsBoolean,
  isDigital: parseAsBoolean,
};

export type ProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "title" | "avgRating";
  sortOrder: "asc" | "desc";
  minPrice: number | null;
  maxPrice: number | null;
  onSale: boolean | null;
  isDigital: boolean | null;
};

// ---------- Admin products ----------

export const adminProductSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "title", "status"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  minPrice: parseAsFloat,
  maxPrice: parseAsFloat,
};

export type AdminProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "title" | "status";
  sortOrder: "asc" | "desc";
  status: string[];
  minPrice: number | null;
  maxPrice: number | null;
};

// ---------- My products (seller dashboard) ----------

export const myProductSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "title", "status"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsString).withDefault([]),
};

export type MyProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "title" | "status";
  sortOrder: "asc" | "desc";
  status: string[];
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

// ---------- Admin organizations ----------

export const adminOrgSearchParams = {
  search: parseAsString.withDefault(""),
  verified: parseAsStringEnum(["true", "false", ""] as const).withDefault(""),
};

export type AdminOrgFilters = {
  search: string;
  verified: string;
};
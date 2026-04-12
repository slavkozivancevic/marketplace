import {
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

export const productSearchParams = {
  search: parseAsString.withDefault(""),
  sortBy: parseAsStringEnum(["createdAt", "price", "title"] as const).withDefault("createdAt"),
  sortOrder: parseAsStringEnum(["asc", "desc"] as const).withDefault("desc"),
};

export type ProductFilters = {
  search: string;
  sortBy: "createdAt" | "price" | "title";
  sortOrder: "asc" | "desc";
};

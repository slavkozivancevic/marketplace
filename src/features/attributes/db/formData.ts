import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { getAttributesForSelector } from "./attributes";
import { getCategoryAttributeMap } from "@/features/categories/db/categories";

/**
 * Shared cached fetchers for the product form's attribute capture section,
 * used by every create/edit product page (admin + seller dashboard).
 */

export async function fetchAttributeSelector() {
  "use cache";
  cacheTag(CacheTags.attributes.all());
  return getAttributesForSelector();
}

export async function fetchCategoryAttributeMap() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getCategoryAttributeMap();
}

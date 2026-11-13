import type { BrandHeaderSource } from "@/features/brands/components/BrandPageHeader";

/**
 * The brand page's loading state gets no data, but the links that lead there
 * (the brand directory, the home page's brand strip) already hold the brand.
 * They record it on click, keyed by slug, and the skeleton draws the real
 * header from it. Module state only - never storage - so a server-rendered
 * skeleton (empty map) and its hydration always agree.
 */
const bySlug = new Map<string, BrandHeaderSource>();

function normalize(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function rememberBrandForPage(slug: string, brand: BrandHeaderSource): void {
  if (slug) bySlug.set(normalize(slug), brand);
}

/** The brand recorded for this slug, or `undefined` when no link recorded it. */
export function brandPageHint(slug: string | undefined): BrandHeaderSource | undefined {
  return slug ? bySlug.get(normalize(slug)) : undefined;
}

/**
 * What the product page's loading skeleton cannot know on its own: how many
 * gallery items the product has. The thumbnail strip under the main frame
 * exists only for two or more items, and its height (64px + the 12px gap)
 * moves everything below it on a one-column layout, so a skeleton that guesses
 * wrong makes the page jump the moment it arrives.
 *
 * Whoever links to a product page and already holds the product (the product
 * card, quick view) records the count on click; the skeleton reads it by the
 * slug of the route it is standing in for. Module state only - never storage -
 * so a server-rendered skeleton (empty map) and its hydration always agree, and
 * a hint lives exactly as long as the tab's client-side navigation does.
 */
const mediaCountBySlug = new Map<string, number>();

function normalize(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function rememberProductMediaCount(slug: string, count: number | undefined): void {
  // A card payload cached before `mediaCount` existed carries no count; the
  // skeleton then falls back to its default rather than to a wrong number.
  if (!slug || typeof count !== "number") return;
  mediaCountBySlug.set(normalize(slug), count);
}

/** The recorded count for this slug, or `undefined` when nothing recorded it. */
export function productMediaCountHint(slug: string | undefined): number | undefined {
  if (!slug) return undefined;
  return mediaCountBySlug.get(normalize(slug));
}

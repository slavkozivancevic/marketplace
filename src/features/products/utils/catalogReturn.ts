/**
 * Where the catalog was when the buyer left it.
 *
 * A product page's "Back to products" has to land on the list the buyer was
 * actually looking at - their search, filters, sort - and not on a reset
 * catalog that throws that work away. The list URL already encodes all of it,
 * so remembering the URL is enough; nothing here understands filters.
 *
 * Kept in sessionStorage rather than in the product URL. It is per tab, it
 * survives a reload of the product page, it never reaches another visitor, and
 * it leaves product URLs canonical - a `?from=` suffix would fracture them for
 * crawlers and for anyone sharing the link. Every access is wrapped: storage
 * throws in a private window and can be switched off entirely, and a miss just
 * falls back to the plain catalog.
 */
const KEY = "mv:catalog-return";

type Remembered = { url: string; locale: string };

export function rememberCatalogUrl(url: string, locale: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ url, locale } satisfies Remembered));
  } catch {
    // No storage - the back link stays the plain catalog link.
  }
}

export function readCatalogUrl(locale: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Remembered>;
    // The locale is baked into the stored path, so a remembered /sr URL is the
    // wrong page the moment the visitor switches language on the product page.
    if (!parsed.url || parsed.locale !== locale) return null;
    // Same-origin path only. `//host` is a protocol-relative URL, which would
    // turn a tampered storage entry into an off-site link.
    const ok = parsed.url.startsWith("/") && !parsed.url.startsWith("//");
    return ok ? parsed.url : null;
  } catch {
    return null;
  }
}

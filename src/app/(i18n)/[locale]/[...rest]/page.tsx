import { notFound } from "next/navigation";

/**
 * Catch-all under [locale] that exists for one reason: Next.js only renders
 * a segment-level not-found.tsx when notFound() is explicitly thrown from
 * inside that segment. A bare URL miss (e.g. /sr/pp/proizvodi) otherwise
 * falls through to the ROOT not-found.tsx, which sits above
 * [locale]/layout.tsx and so has no NextIntlClientProvider, no PublicHeader,
 * no Footer.
 *
 * By catching unmatched paths here and explicitly calling notFound(), we
 * force Next to render [locale]/not-found.tsx with the full locale layout
 * chain (provider + chrome) wrapped around it.
 *
 * This renders 404 CONTENT under a 200 STATUS, and cannot be made to do
 * otherwise. Under `cacheComponents` (PPR) the layout chain's prerendered
 * shell is flushed - status line included - before this component runs, so
 * notFound() has nothing left to change. An `await connection()` here was
 * deployed to staging to test exactly that and made no difference: the page
 * still answered 200, because the shell being flushed comes from the layout
 * above, not from this page. Real 404 statuses are produced in the proxy
 * instead - see `isUnservableStorefrontPath` and `notFoundResponse`.
 */
export default function LocaleCatchAll() {
  notFound();
}

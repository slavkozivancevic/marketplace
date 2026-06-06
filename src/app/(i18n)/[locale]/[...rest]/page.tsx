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
 */
export default function LocaleCatchAll() {
  notFound();
}

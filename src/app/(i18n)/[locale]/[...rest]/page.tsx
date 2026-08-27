import { connection } from "next/server";
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
export default async function LocaleCatchAll() {
  // Opts this route out of the prerendered shell so the miss can answer with a
  // real 404 status, not just 404 content.
  //
  // Under `cacheComponents` (PPR) Next flushes the static shell - headers and
  // all - before the dynamic boundary runs, so by the time notFound() executes
  // the response has already committed 200. Measured on staging: /foo/bar and
  // /en/nepostojeca-stranica both rendered the correct not-found page, with its
  // `noindex`, under HTTP 200. Search engines honour noindex regardless of
  // status, so nothing was being indexed - but a 404 that reports 200 is
  // invisible to link checkers, uptime monitors and our own Http5xx-style
  // signals, and it is simply not what the protocol says.
  //
  // `connection()` marks the render as request-time, which keeps the shell from
  // being flushed early. Same mechanism /api/health relies on.
  await connection();
  notFound();
}

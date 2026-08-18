import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { asLocale } from "@/i18n/config";
import { ClerkLocaleProvider } from "@/providers/providers";
import { ThemeProvider } from "@/providers/theme/ThemeProvider";
import { NotFoundHeader } from "@/components/layout/not-found-header";
import { Footer } from "@/components/layout/footer";
import { HardNavBoundary } from "@/components/layout/hard-nav-boundary";
import { NotFoundContent } from "@/components/layout/not-found-content";

/**
 * Locale-level not-found. Next.js renders not-found.tsx OUTSIDE its sibling
 * [locale]/layout.tsx (only the root layout wraps it), so the layout's
 * providers aren't in scope. Rather than rebuild the whole app shell here -
 * react-query, the chat socket, currency rates - which is fragile and
 * pointless on an error page, we ship a lean chrome:
 *
 *   <ClerkLocaleProvider>     - Clerk auth UI (sign-in / user button)
 *     <NextIntlClientProvider> - translations for the header/footer
 *       <ThemeProvider>        - light client-only theme state (cookie-backed)
 *         <HardNavBoundary>    - every link leaves via a full page load,
 *                                the only reliable exit from Next's not-found
 *                                router state (vercel/next.js#64053)
 *
 * The lean <NotFoundHeader> carries logo, primary nav, the language/theme/
 * currency popover, and Clerk's auth UI - no socket/query-backed widgets.
 */
export default async function NotFoundPage() {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("notFound");

  return (
    <ClerkLocaleProvider locale={asLocale(locale)}>
      {/* Next 16 PPR (`cacheComponents`) + the next-intl middleware rewrite
          flush the static shell with HTTP 200 before this dynamic not-found
          boundary renders, so notFound() can't set a 404 status. noindex keeps
          these soft-404 pages out of the search index regardless of status. */}
      <meta name="robots" content="noindex, follow" />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ThemeProvider>
          <HardNavBoundary>
            {/* `overflow-clip`, not `overflow-hidden` - see admin/layout.tsx:
                the shell must never be a scroll container, or a sideways
                overflow can park the whole page in a blank void. */}
            <div className="flex h-dvh flex-col overflow-clip">
              <NotFoundHeader />
              <main className="flex-1 flex flex-col min-h-0 overflow-clip">
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                  <div className="flex-1 flex items-center justify-center px-6 py-12">
                    <NotFoundContent
                      eyebrow={t("title")}
                      heading={t("page")}
                      description={t("pageDescription")}
                      backHref="/"
                      backLabel={t("backToHome")}
                    />
                  </div>
                  <Footer />
                </div>
              </main>
            </div>
          </HardNavBoundary>
        </ThemeProvider>
      </NextIntlClientProvider>
    </ClerkLocaleProvider>
  );
}

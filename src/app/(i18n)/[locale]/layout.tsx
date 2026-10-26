import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "../../globals.css";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { routing } from "@/i18n/routing";
import {
  StableOuterProviders,
  ClerkLocaleProvider,
  InnerProviders,
} from "@/providers/providers";
import { CurrencyRatesProvider } from "@/providers/CurrencyRatesProvider";
import { MarketProvider } from "@/providers/MarketProvider";
import { getViewerCountry } from "@/features/priceMarkets/db/viewer";
import { getPriceMarketConfig } from "@/features/priceMarkets/db/markets";
import { getCurrencyRates } from "@/features/currency/db/currencyRates";
import { FoucScript } from "@/providers/theme/FoucScript";
import { ScrollbarScript } from "@/providers/scrollbars/ScrollbarScript";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { LocaleSwitchLoader } from "@/components/layout/locale-switch-loader";
import { BootLoaderFallback } from "@/components/layout/boot-loader-fallback";
import { HistoryHydrationGate } from "@/lib/navigation/hydrationGate";
import { CacheTags } from "@/lib/cache/tags";
import { cn } from "@/lib/utils";
import { env } from "@/env/server";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const BG_IMAGE_URL =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";

export const metadata: Metadata = {
  // Resolves any relative URL in child metadata against the real origin
  // (per-page metadata already emits absolute URLs, but this keeps Next from
  // falling back to localhost and silences the metadataBase warning).
  metadataBase: new URL(env.APP_URL),
  title: "MarketVerse",
  description: "MarketVerse - modern commerce, built for scale",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app draw under the notch/home-indicator instead of leaving it
  // blank, and - more importantly - is what makes `env(safe-area-inset-*)`
  // resolve to real values instead of 0 (used for the mobile sidebar trigger
  // and other bottom-pinned UI).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.94 0.008 240)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.13 0 0)" },
  ],
};

async function fetchCurrencyRates() {
  "use cache";
  cacheTag(CacheTags.currency.rates());
  return getCurrencyRates();
}

async function loadMessages(locale: string) {
  "use cache";
  cacheTag(`messages:${locale}`);
  return (await import(`../../../../messages/${locale}.json`)).default;
}

/**
 * Root layout for all localized routes. Owns the `<html>` / `<body>` shell
 * and sets `<html lang>` from the `[locale]` URL segment so the correct
 * locale ships in static HTML (view-source, no-JS crawlers).
 *
 * Provider tree:
 *
 *   <html lang={locale}> <body>
 *     <StableOuterProviders>                   ← theme, nuqs, query
 *       <ClerkLocaleProvider locale={locale}>  ← per-locale Clerk URLs
 *         <Suspense>
 *           <NextIntlClientProvider>           ← swaps messages
 *             <CurrencyRatesProvider>
 *               <InnerProviders>{children}</>  ← tooltip, chat, toaster
 *
 * Trade-off owned here: locale change re-renders this layout (params
 * change) which re-renders `<StableOuterProviders>` and `<ThemeProvider>`
 * inside it. The inline FOUC script in `<ThemeProvider>` then trips a
 * React 19 dev warning ("script inside a component") on the subsequent
 * client-side render. The warning is dev-only - production builds don't
 * print it - and the script's behavior is correct: it ran once when the
 * initial HTML was parsed and React doesn't re-execute it on client
 * navigations.
 *
 * Lifting the stable providers into a higher `(i18n)/layout.tsx` would
 * silence the warning but breaks `cacheComponents`: that higher layout
 * would need to read locale (for `<html lang>`) via dynamic APIs, which
 * makes the entire tree dynamic and rejects static prerender of every
 * descendant page.
 *
 * The not-found fallback for an invalid locale (or any route that doesn't
 * match `[locale]/...`) is served by `app/(fallback)/`, which owns its own
 * separate `<html>` shell.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background antialiased">
        {/* Inline FOUC bootstrap. Lives at the top of <body> so the browser's
            HTML parser executes it before any visible content paints. See
            FoucScript.tsx for the React-19-warning workaround details. */}
        <FoucScript />
        <ScrollbarScript />
        {/* Parser-run like the two above: a Back/Forward that arrives before
            the streamed app hydrates becomes a full load instead of a soft
            navigation React cannot hydrate. */}
        <HistoryHydrationGate />
        {/* Wrapped in Suspense: NavigationProgress is a client component that
            reads usePathname(), a dynamic API. Outside a Suspense boundary that
            opts the whole route into blocking (dev "blocking-route" warning)
            under cacheComponents. The boundary isolates it; it renders null. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {/* Language-switch arrival detector (renders null). The overlay
            itself is a plain DOM node managed outside React (see
            localeSwitchOverlay.ts) so no mid-switch commit can unmount or
            remount it. The detector lives HERE, above the suspending intl
            providers, so it exists in every phase of the switch and gets the
            new locale straight from the [locale] param. Uses no intl hooks. */}
        <LocaleSwitchLoader locale={locale} />
        <div className="app-shell">
          {/* Inside the shell, not a sibling of it: the backdrop is
              `position: absolute` and sizes off `.app-shell`, so it can never
              be wider than the app itself (see globals.css). */}
          <div className="page-background">
            <Image
              src={BG_IMAGE_URL}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority
              unoptimized
            />
          </div>
          <StableOuterProviders>
            <ClerkLocaleProvider locale={locale}>
              {/* Fallback mirrors <AppLoader> (see boot-loader-fallback.tsx):
                  this boundary suspends on real async work (messages, currency
                  rates) both on first boot and on every locale switch, and
                  <ClerkGate>'s <AppLoader> lives inside it - so a `null`
                  fallback left a beat with nothing rendered but the page
                  background, visible as the spinner flashing away and back. */}
              <Suspense fallback={<BootLoaderFallback />}>
                <LocaleDataProviders locale={locale}>
                  <InnerProviders>{children}</InnerProviders>
                </LocaleDataProviders>
              </Suspense>
            </ClerkLocaleProvider>
          </StableOuterProviders>
        </div>
      </body>
    </html>
  );
}

async function LocaleDataProviders({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [messages, rates, cookieStore, viewerCountry, marketConfig] = await Promise.all([
    loadMessages(locale),
    fetchCurrencyRates(),
    cookies(),
    // The pricing country, the same way: read per request, never part of a
    // cached payload or a cache key. The market map rides along so a country
    // switch resolves its market on the client, without a round trip.
    getViewerCountry(),
    getPriceMarketConfig(),
  ]);
  const initialCurrency = cookieStore.get("NEXT_CURRENCY")?.value;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CurrencyRatesProvider rates={rates} initialCurrency={initialCurrency}>
        <MarketProvider country={viewerCountry} config={marketConfig}>
          {children}
        </MarketProvider>
      </CurrencyRatesProvider>
    </NextIntlClientProvider>
  );
}

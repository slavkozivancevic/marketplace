"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { NuqsAdapter } from "nuqs/adapters/next";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./QueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatDrawerRoot } from "@/features/chat/components/ChatDrawer";
import { LocalePathsHost } from "@/i18n/LocalePathsContext";
import { LocaleSync } from "@/components/layout/locale-sync";
import { ThemeProvider } from "@/providers/theme/ThemeProvider";
import { type Locale } from "@/i18n/config";

/**
 * Provider tree splits across two layout levels:
 *
 *   (i18n)/[locale]/layout.tsx                 ← root, has html/body
 *     <StableOuterProviders>                   ← theme, nuqs, query
 *       <ClerkLocaleProvider locale=...>       ← swaps Clerk URLs on switch
 *         <Suspense>
 *           <NextIntlClientProvider>           ← swaps intl messages
 *             <CurrencyRatesProvider>
 *               <InnerProviders>               ← needs intl context
 *                 page
 *
 * The theme provider is our custom implementation (`@/providers/theme`)
 * rather than `next-themes`. next-themes renders an inline FOUC script in
 * its component tree which trips React 19's "script inside a component"
 * warning every time the layout re-renders on locale change. Our provider
 * relies on a `theme` cookie read server-side and applied to `<html>`
 * directly in the layout, so there's no script in the React tree at all.
 */
export function StableOuterProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <NuqsAdapter>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </NuqsAdapter>
    </Suspense>
  );
}

export function ClerkLocaleProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  // ClerkProvider re-renders on locale change to update its URL props - so a
  // redirect-mode SignInButton click goes straight to /sr/sign-in. ClerkProvider
  // is robust to prop changes without losing its session state.
  const signInUrl = `/${locale}/sign-in`;
  const signUpUrl = `/${locale}/sign-up`;
  const localeHome = `/${locale}`;

  return (
    <ClerkProvider
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      signInFallbackRedirectUrl={localeHome}
      signUpFallbackRedirectUrl={localeHome}
      // Configured here per Clerk's guidance - the per-component
      // `afterSignOutUrl` on `<UserButton>` is deprecated in favor of this
      // global setting, which keeps sign-out routing consistent everywhere.
      afterSignOutUrl={localeHome}
    >
      {children}
    </ClerkProvider>
  );
}

export function InnerProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {/* Holds per-page locale URL map (product/brand/category slugs) so
          the language switcher in the header can read it. Sits above
          both the header and the page so cross-tree state works. */}
      <LocalePathsHost>
        <LocaleSync />
        {children}
        <Toaster />
        <ChatDrawerRoot />
      </LocalePathsHost>
    </TooltipProvider>
  );
}
"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { NuqsAdapter } from "nuqs/adapters/next";
import { Suspense, type ComponentProps } from "react";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./QueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatDrawerRoot } from "@/features/chat/components/ChatDrawer";
import { ChatRuntimeProvider } from "@/features/chat/components/ChatRuntime";
import { ClerkGate } from "@/components/layout/app-loader";
import { FlashHost } from "@/components/layout/flash-host";
import { LocalePathsHost } from "@/i18n/LocalePathsContext";
import { LocaleSync } from "@/components/layout/locale-sync";
import { NavigationGenerationTracker } from "@/components/layout/navigation-generation-tracker";
import { ThemeProvider } from "@/providers/theme/ThemeProvider";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { HydrationMark } from "@/lib/navigation/hydrationGate";
import { CLERK_LOCALIZATIONS } from "@/lib/auth/clerkLocalization";
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

/**
 * Clerk's components drawn from the app's own theme tokens. The values are
 * CSS variables, not colours, so light, dark and cosmos switch with the
 * `<html>` class like the rest of the app - no theme state to pass in, and no
 * white card on a dark page.
 */
const CLERK_APPEARANCE: ComponentProps<typeof ClerkProvider>["appearance"] = {
  variables: {
    colorBackground: "var(--card)",
    colorForeground: "var(--card-foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    // A base colour, not the app's `--border`: Clerk applies its own alpha
    // (7-11%) on top, and the dark tokens are already 10-50% opaque, so the
    // two multiplied into lines nobody could see.
    colorBorder: "var(--foreground)",
    colorRing: "var(--ring)",
    colorDanger: "var(--destructive)",
    colorNeutral: "var(--foreground)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-sans)",
  },
};

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
      localization={CLERK_LOCALIZATIONS[locale]}
      appearance={CLERK_APPEARANCE}
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
        {/* One chat connection for the whole app - the drawer and the
            `/messages` page both talk through it. Wraps the page as well as
            the drawer, so the page can reach the socket. */}
        <ChatRuntimeProvider>
          <LocaleSync />
          <NavigationGenerationTracker />
          {/* Mobile/touch pull-to-refresh. Sits above the page so its indicator
              floats over the sticky header, like the platform gesture does. */}
          <PullToRefresh />
          <ClerkGate>{children}</ClerkGate>
          {/* Tells HistoryHydrationGate (root layout) that the streamed app
              has hydrated and Back/Forward may soft-navigate again. */}
          <HydrationMark />
          <Toaster />
          {/* Raises the toast a create/edit queued before it navigated away -
              the confirmation belongs to the list we land on, not to the form
              that is unmounting. Must sit beside the Toaster, outside any page. */}
          <FlashHost />
          <ChatDrawerRoot />
        </ChatRuntimeProvider>
      </LocalePathsHost>
    </TooltipProvider>
  );
}
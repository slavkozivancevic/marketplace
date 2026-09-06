"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter as useNextRouter, useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTheme } from "@/providers/theme/ThemeProvider";
import { useEffect, useState, useTransition } from "react";
import { setCurrency } from "@/actions/setCurrency";
import { useLocalePaths } from "@/i18n/LocalePathsContext";
import { markLanguageSwitch, shouldHardSwitchLocale } from "@/lib/i18n/localeSwitch";
import { localeSwitchOverlayStore } from "@/lib/i18n/localeSwitchOverlay";
import { useUnsavedGuardStore } from "@/lib/forms/unsavedGuard";
import { useHardNav } from "@/components/layout/hard-nav-boundary";
import type { Locale } from "@/i18n/config";
import { VALID_CURRENCIES } from "@/lib/currency-config";
import { useCurrencyStore } from "@/store/currency";
import { SUPPORTED_LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { Sun, Moon, Sparkles, Monitor, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const currencySymbols: Record<string, string> = {
  usd: "$",
  eur: "€",
  rsd: "дин",
};

// Module-level so the React Compiler doesn't flag the document.cookie write
// as mutating a global from inside the component (same pattern as ThemeProvider).
function persistLocaleCookie(newLocale: string) {
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
}

const languages = SUPPORTED_LOCALES.map((loc) => ({
  locale: loc,
  flag: LOCALE_LABELS[loc].flag,
  label: loc.toUpperCase(),
}));

const themes = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "cosmos", icon: Sparkles, label: "Cosmos" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function PreferencesPopover() {
  const tLang = useTranslations("language");
  const tTheme = useTranslations("theme");
  const tCurrency = useTranslations("currency");
  const tHeader = useTranslations("header");
  const locale = useLocale();
  // `useRouter` from `@/i18n/navigation` handles URL-based locale swaps
  // (swapping `/en/products` <-> `/sr/proizvodi`). `useNextRouter` is kept
  // only for `router.refresh()` after a currency change, which is plain
  // revalidation with no URL rewrite.
  const router = useRouter();
  const nextRouter = useNextRouter();
  const pathname = usePathname();
  const params = useParams();
  const localePaths = useLocalePaths();
  // True on the 404 page, where the App Router won't commit soft navigation.
  // See HardNavBoundary - language/currency must navigate via window.location.
  const hardNav = useHardNav();
  const [, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Flags load from flagcdn.com, not next/image - track per-locale so each
  // shows a shimmer placeholder instead of a blank gap until it arrives.
  const [loadedFlags, setLoadedFlags] = useState<Partial<Record<Locale, boolean>>>({});
  // Controlled so a language change can close the popover explicitly. On a soft
  // (storefront) locale swap the menu would otherwise linger open and Radix
  // re-anchors it against the new tree - it ends up clipped behind the header.
  const [open, setOpen] = useState(false);

  const { currency, setCurrency: setStoreCurrency } = useCurrencyStore();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Close on navigation. Radix dismisses this menu on an outside click or
  // Escape, but not on a route change - and a Back/Forward gesture also
  // collapses the header's mobile panel (see useDismissable), which is where
  // this trigger lives on narrow screens. Left open, the menu would be
  // anchored to a trigger that is no longer on screen and hang over the page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  function handleLocale(newLocale: string) {
    // Clicking the already-active language is a no-op - just close the menu
    // (otherwise the switch overlay would flash for nothing).
    if (newLocale === locale) {
      setOpen(false);
      return;
    }
    // A language switch remounts the page and would drop any unsaved form edits.
    // Route it through the unsaved-changes guard so the user gets the same
    // confirmation dialog as any other navigation instead of silently losing work.
    if (!useUnsavedGuardStore.getState().guard(() => doLocaleSwitch(newLocale))) {
      return;
    }
    doLocaleSwitch(newLocale);
  }

  function doLocaleSwitch(newLocale: string) {
    // Close the popover first so it never lingers/clips across the locale swap
    // (consistent behaviour whether we soft- or hard-navigate below).
    setOpen(false);
    // Cover the whole switch with the branded full-page loader: the [locale]
    // remount repaints everything (tables, toolbars, borders visibly settle),
    // so the transition is deliberately hidden behind the loader instead.
    // <LocaleSwitchLoader> (hosted in the root layout, above the suspending
    // intl providers) clears it once the new tree has mounted AND settled; on
    // the hard-nav branch it simply covers until the full reload. The brand
    // label rides along because the overlay renders outside intl context.
    localeSwitchOverlayStore.getState().start(newLocale, tHeader("brand"));
    // Let any page with in-progress state (e.g. a product form) snapshot + restore
    // itself across the remount this locale change triggers. Set before every
    // navigation branch below so it fires regardless of which path we take.
    markLanguageSwitch();
    // Hard-navigate when:
    //  - on a not-found boundary, where router.replace silently no-ops, or
    //  - a page flagged in-progress state to preserve (forms / bulk panel).
    // In the latter case a soft nav would let Next's Router Cache restore the
    // previous locale's cached tree with STALE client state on back-navigation,
    // bypassing the draft restore. A full reload drops that cache; sessionStorage
    // survives it, so the page remounts fresh and restores its draft cleanly.
    if (hardNav || shouldHardSwitchLocale()) {
      persistLocaleCookie(newLocale);
      // Admin/passthrough paths aren't localized, so swapping the locale prefix
      // is the correct target. (Storefront pages with translated slugs never set
      // the preserve flag, so they fall through to the soft-nav branch below.)
      const segments = window.location.pathname.split("/");
      if (SUPPORTED_LOCALES.includes(segments[1] as Locale)) {
        segments[1] = newLocale;
      } else {
        segments.splice(1, 0, newLocale);
      }
      window.location.assign(segments.join("/") + window.location.search);
      return;
    }
    startTransition(() => {
      // Pages with translated dynamic segments (product / brand / category
      // slugs) publish their per-locale URLs via `LocalePathsProvider`.
      // When that's set, jump straight to the pre-resolved URL so the
      // slug also gets translated (`/en/products/my-suit` ->
      // `/sr/proizvodi/muski-vuneni-odelo`, not `/sr/proizvodi/my-suit`
      // which 404s). Otherwise fall back to next-intl's pattern-only swap.
      const targetUrl = localePaths?.[newLocale as Locale];
      if (targetUrl) {
        nextRouter.replace(targetUrl);
        return;
      }
      router.replace(
        { pathname: pathname as never, params: params as never },
        { locale: newLocale as never },
      );
    });
  }

  async function handleCurrency(newCurrency: string) {
    setStoreCurrency(newCurrency as (typeof VALID_CURRENCIES)[number]);
    await setCurrency(newCurrency);
    // The Zustand store update already repaints prices client-side and the
    // cookie persists the choice. On a 404 there's nothing to refresh (and
    // the soft refresh no-ops), so skip it there.
    if (hardNav) return;
    nextRouter.refresh();
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="sr-only">Preferences</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 p-3"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Language */}
        <p className="mb-2 px-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {tLang("label")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {languages.map((lang) => (
            <button
              key={lang.locale}
              onClick={() => handleLocale(lang.locale)}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                locale === lang.locale
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="relative h-3 w-4 shrink-0">
                {!loadedFlags[lang.locale] && (
                  <Skeleton className="absolute inset-0 rounded-sm" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lang.flag}
                  alt={lang.label}
                  width={16}
                  height={12}
                  onLoad={() =>
                    setLoadedFlags((prev) => ({ ...prev, [lang.locale]: true }))
                  }
                  className={cn(
                    "absolute inset-0 h-full w-full rounded-sm object-cover transition-opacity",
                    loadedFlags[lang.locale] ? "opacity-100" : "opacity-0",
                  )}
                />
              </span>
              {lang.label}
            </button>
          ))}
        </div>

        <DropdownMenuSeparator className="my-3" />

        {/* Currency */}
        <p className="mb-2 px-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {tCurrency("label")}
        </p>
        <div className="flex gap-1.5">
          {VALID_CURRENCIES.map((code) => (
            <button
              key={code}
              onClick={() => handleCurrency(code)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                mounted && currency === code
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground",
              )}
            >
              {code.toUpperCase()}
              <span className="opacity-50">{currencySymbols[code]}</span>
            </button>
          ))}
        </div>

        <DropdownMenuSeparator className="my-3" />

        {/* Theme */}
        <p className="mb-2 px-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {tTheme("appearance")}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {themes.map((th) => {
            const Icon = th.icon;
            const isActive = mounted && theme === th.value;
            return (
              <button
                key={th.value}
                onClick={() => setTheme(th.value)}
                title={th.label}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-md border py-2 transition-colors",
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

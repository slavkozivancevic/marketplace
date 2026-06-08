"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { usePathname, getPathname } from "@/i18n/navigation";
import Image from "next/image";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, asLocale } from "@/i18n/config";
import { syncUserLocale } from "@/actions/syncUserLocale";
import { markLanguageSwitch } from "@/lib/i18n/localeSwitch";

const languages = SUPPORTED_LOCALES.map((loc) => ({
  locale: loc,
  flag: LOCALE_LABELS[loc].flag,
  label: LOCALE_LABELS[loc].label,
}));

/**
 * Changing language navigates to the same page's translated URL in the target
 * locale (e.g. `/sr/proizvodi/foo` -> `/en/products/foo`). next-intl's
 * `getPathname` resolves that localized path from the `pathnames` mapping in
 * `src/i18n/routing.ts`.
 *
 * We deliberately do NOT use next-intl's `useRouter().replace`: when a
 * `pathnames` map is configured it drops the `query` part of the href (it runs
 * the href through `normalizeNameOrNameWithParams`, which keeps only pathname +
 * params). That would strip URL-backed UI state like `?tab=`. Instead we build
 * the localized destination ourselves, re-append the current query, set the
 * NEXT_LOCALE cookie (what next-intl's router would have done), and navigate
 * with the plain Next router - which keeps the query string intact.
 */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = asLocale(useLocale());
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const current =
    languages.find((l) => l.locale === locale) ??
    languages.find((l) => l.locale === DEFAULT_LOCALE)!;

  function handleSelect(newLocale: string) {
    // Let pages with in-progress state restore it across the locale remount.
    markLanguageSwitch();
    // `getPathname` is the same call next-intl's router makes internally to
    // localize the path; appending the live query (e.g. ?tab=) is the bit the
    // router would otherwise discard. Read the query from the address bar since
    // history.replaceState updates are not reflected in useSearchParams.
    const target =
      getPathname({ href: { pathname, params } as never, locale: newLocale as never }) +
      window.location.search;

    startTransition(() => {
      // Persist preference to User.locale for signed-in users so recipient-targeted
      // emails (role changes, seller notifications) reach them in this language.
      // Fire-and-forget: failure must not block the visible UI switch.
      syncUserLocale(newLocale).catch((err) =>
        console.error("[language-switcher] syncUserLocale failed", err),
      );
      // Persist the locale the way next-intl's router would have, so a later visit
      // to a naked URL ("/") still resolves to this language.
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
      router.replace(target);
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 cursor-pointer! overflow-hidden"
          disabled={isPending}
        >
          <Image
            src={current.flag}
            alt={current.label}
            width={20}
            height={15}
            className="rounded-sm object-cover"
            unoptimized
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {t("label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.locale}
            onClick={() => handleSelect(lang.locale)}
            className="flex items-center gap-3 cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lang.flag}
              alt={lang.label}
              width={20}
              height={15}
              className="rounded-sm object-cover shrink-0"
            />
            <span className="text-sm font-medium">{lang.label}</span>
            {locale === lang.locale && (
              <Check className="h-4 w-4 ml-auto shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

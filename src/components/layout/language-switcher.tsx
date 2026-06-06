"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
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

const languages = SUPPORTED_LOCALES.map((loc) => ({
  locale: loc,
  flag: LOCALE_LABELS[loc].flag,
  label: LOCALE_LABELS[loc].label,
}));

/**
 * The switcher uses next-intl's `useRouter` so changing language replaces
 * the current URL with its translated equivalent in the target locale
 * (e.g. `/sr/proizvodi/foo` -> `/en/products/foo`). next-intl reads the
 * `pathnames` mapping in `src/i18n/routing.ts` to figure that out and also
 * writes the NEXT_LOCALE cookie so the next naked-URL visit lands in the
 * same language.
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
    startTransition(() => {
      // Persist preference to User.locale for signed-in users so
      // recipient-targeted emails (role changes, seller notifications)
      // reach them in this language. Fire-and-forget: failure must not
      // block the visible UI switch.
      syncUserLocale(newLocale).catch((err) =>
        console.error("[language-switcher] syncUserLocale failed", err),
      );
      // next-intl's `useRouter().replace` accepts the same shape as Link.
      // Passing the current pathname + params keeps the user on the same
      // page; next-intl handles the localized-segment swap internally.
      // The `as never` casts here trade some type safety for the fact
      // that `pathname` is a generic typed-routes string and `params` is
      // a generic record - both fully validated upstream by next-intl.
      router.replace(
        { pathname: pathname as never, params: params as never },
        { locale: newLocale as never },
      );
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

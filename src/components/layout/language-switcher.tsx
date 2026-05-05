"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLocale } from "@/actions/setLocale";
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

const languages: { locale: string; flag: string; label: string }[] = [
  { locale: "en", flag: "https://flagcdn.com/w40/gb.png", label: "English" },
  { locale: "sr", flag: "https://flagcdn.com/w40/rs.png", label: "Srpski" },
];

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();

  const current = languages.find((l) => l.locale === locale) ?? languages[0];

  async function handleSelect(newLocale: string) {
    await setLocale(newLocale);
    router.refresh();
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 cursor-pointer! overflow-hidden"
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

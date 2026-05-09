"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { setLocale } from "@/actions/setLocale";
import { Sun, Moon, Sparkles, Monitor, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const languages = [
  { locale: "en", flag: "https://flagcdn.com/w40/gb.png", label: "EN" },
  { locale: "sr", flag: "https://flagcdn.com/w40/rs.png", label: "SR" },
];

const themes = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "cosmos", icon: Sparkles, label: "Cosmos" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function PreferencesPopover() {
  const tLang = useTranslations("language");
  const tTheme = useTranslations("theme");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  async function handleLocale(newLocale: string) {
    await setLocale(newLocale);
    router.refresh();
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
        >
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
        <div className="flex gap-1.5">
          {languages.map((lang) => (
            <button
              key={lang.locale}
              onClick={() => handleLocale(lang.locale)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                locale === lang.locale
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lang.flag}
                alt={lang.label}
                width={16}
                height={12}
                className="shrink-0 rounded-sm object-cover"
              />
              {lang.label}
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
                    : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground"
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

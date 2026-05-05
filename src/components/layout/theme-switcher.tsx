"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Sparkles, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const themes = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Clean & minimal",
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
    description: "Easy on the eyes",
  },
  {
    value: "cosmos",
    label: "Cosmos",
    icon: Sparkles,
    description: "Deep space vibes",
  },
  {
    value: "system",
    label: "System",
    icon: Monitor,
    description: "Match your OS",
  },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const currentTheme = themes.find((t) => t.value === theme) ?? themes[0];
  const Icon = currentTheme.icon;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative overflow-hidden group"
        >
          <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((t) => {
          const ThemeIcon = t.icon;
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <ThemeIcon className="h-4 w-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">
                  {t.description}
                </span>
              </div>
              {theme === t.value && (
                <Check className="h-4 w-4 ml-auto shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

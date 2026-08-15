"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HeaderAuth } from "./header-auth";
import { PreferencesPopover } from "./preferences-popover";
import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { cn } from "@/lib/utils";

export function AdminHeader() {
  const t = useTranslations("header");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const el = main.querySelector(".overflow-y-auto") ?? main;
    const handleScroll = () => setScrolled(el.scrollTop > 20);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b header-bg transition-shadow duration-500",
        scrolled
          ? "shadow-lg shadow-black/5 border-border"
          : "border-border/50",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg brand-tile transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-105 shrink-0">
              <BrandMark className="h-7 w-7" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold tracking-tight leading-tight truncate">
                <BrandWordmark />
              </span>
              {/* Font-size scales down continuously below ~400px (floor
                  4px) instead of clipping - tracking (`0.2em`, relative)
                  auto-shrinks with it, no separate rule needed. */}
              <span className="text-[clamp(1.5px,5.47vw-11.3px,10px)] font-medium uppercase tracking-[0.2em] text-muted-foreground leading-tight truncate">
                {t("adminTagline")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <PreferencesPopover />
            {/* Admin is an auth-gated route, so the user is always signed in
                here - hand that down so the auth controls render under the
                boot loader instead of popping in once clerk-js settles. */}
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <HeaderAuth mode="redirect" showDashboardLink={false} signedIn />
            </div>
            {/* Avatar-only below sm, always the rightmost element, so it's
                obvious at a glance who's signed in even on the narrowest
                widths; the full controls (with the dashboard link) take
                over at sm - never both at once. There's nothing else that
                needs a mobile menu here (nav lives in the separate
                AdminSidebar), so no hamburger/dropdown either. */}
            <div className="sm:hidden">
              <HeaderAuth mode="redirect" avatarOnly signedIn />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

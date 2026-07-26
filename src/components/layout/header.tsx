"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HeaderAuth } from "./header-auth";
import { PreferencesPopover } from "./preferences-popover";
import { ChatDrawerTrigger } from "@/features/chat/components/ChatDrawer";
import { Menu, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          : "border-border/50"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 min-w-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg brand-tile transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-105 shrink-0">
              <BrandMark className="h-7 w-7" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold tracking-tight leading-tight truncate">
                <BrandWordmark />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground leading-tight truncate">
                {t("header.dashboardTagline")}
              </span>
            </div>
          </Link>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Below sm these move into the mobile menu instead, so the
                header rail stays short enough to never crowd the logo. */}
            <div className="hidden sm:flex items-center gap-1 sm:gap-2">
              <PreferencesPopover />
              {/* Dashboard is an auth-gated route, so the user is always signed
                  in here - hand that down so the auth controls render under the
                  boot loader instead of popping in once clerk-js settles. */}
              <ChatDrawerTrigger signedIn />
            </div>
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <HeaderAuth mode="redirect" showDashboardLink={false} signedIn />
            </div>
            {/* Mobile menu button */}
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden h-9 w-9"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu - grid-rows[0fr -> 1fr] instead of a fixed max-h so the
          collapse always fits its content instead of clipping the last row. */}
      <div
        className={cn(
          "sm:hidden grid transition-[grid-template-rows] duration-300 ease-in-out border-t border-border/50",
          mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr] border-t-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1">
              <PreferencesPopover />
              <ChatDrawerTrigger signedIn />
            </div>
            <div className="pt-2 px-3">
              <HeaderAuth mode="redirect" showDashboardLink={false} signedIn />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

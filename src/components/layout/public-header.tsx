"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { HeaderAuth } from "./header-auth";
import { PreferencesPopover } from "./preferences-popover";
import { CartButton } from "@/features/cart/components/CartButton";
import { CartDrawer } from "@/features/cart/components/CartDrawer";
import { WishlistHeaderButton } from "@/features/wishlist/components/WishlistHeaderButton";
import { ChatDrawerTrigger } from "@/features/chat/components/ChatDrawer";
import { Store, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PublicHeaderProps {
  showAdminLink?: boolean;
  /**
   * Server-resolved auth state (from `auth()` in the layout). Used as the
   * authoritative value for auth-gated links until clerk-js finishes its
   * client-side session handshake - so the links are in the SSR HTML (under
   * the boot loader) instead of popping in a second after the loader lifts.
   */
  signedIn?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  authGated?: boolean;
}

export function PublicHeader({
  showAdminLink = false,
  signedIn = false,
}: PublicHeaderProps) {
  const t = useTranslations();
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // mounted + useAuth pattern: avoids a hydration mismatch (SSR may know the
  // session while the first client render, before clerk-js loads, does not).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Clerk resolves auth in two steps on a cold load: `isLoaded` flips true
  // (clerk-js mounted) before `isSignedIn` settles true (session handshake).
  // The boot loader (<ClerkGate>) only waits for `isLoaded`, so gating these
  // links on the live `isSignedIn` made them pop in ~1s after the loader
  // lifted. Until Clerk is fully loaded we trust the server-rendered
  // `signedIn` prop (identical on SSR and first client render, so no
  // hydration mismatch), then switch to the live value once it's settled.
  const effectiveSignedIn = mounted && isLoaded ? isSignedIn : signedIn;

  const baseNavLinks: NavLink[] = [
    { href: "/products", label: t("nav.products") },
    { href: "/brands", label: t("nav.brands") },
    { href: "/dashboard", label: t("nav.dashboard"), authGated: true },
  ];
  const navLinks: NavLink[] = showAdminLink
    ? [...baseNavLinks, { href: "/admin", label: t("nav.admin"), authGated: true }]
    : baseNavLinks;

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const el = main.querySelector(".overflow-y-auto") ?? main;
    const handleScroll = () => setScrolled(el.scrollTop > 20);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b header-bg transition-shadow duration-500",
          scrolled
            ? "shadow-lg shadow-black/5 border-border"
            : "border-border/50"
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            {/* Logo - flex-1 left rail keeps the center nav screen-centered */}
            <div className="flex flex-1 justify-start min-w-0">
            <Link
              href="/"
              className="group flex items-center gap-2.5 shrink-0"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-105">
                <Store className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight leading-tight">
                  {t("header.brand")}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground leading-tight">
                  {t("header.tagline")}
                </span>
              </div>
            </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 shrink-0">
              {navLinks.map((link) => {
                const linkEl = (
                  <Link
                    key={link.href}
                    href={link.href as never}
                    className="relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
                  >
                    {link.label}
                    <span className="absolute inset-x-4 -bottom-px h-px bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                  </Link>
                );
                if (!link.authGated) return linkEl;
                if (!effectiveSignedIn) return null;
                return linkEl;
              })}
            </nav>

            {/* Right side actions - flex-1 right rail mirrors the left */}
            <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
              <PreferencesPopover />
              <ChatDrawerTrigger signedIn={signedIn} />
              {/* Always visible - count is 0 (query disabled) when signed out,
                  and clicking through to /wishlist redirects guests to sign-in. */}
              <WishlistHeaderButton />
              <CartButton />
              <div className="hidden sm:flex items-center gap-2 ml-1">
                <HeaderAuth mode="modal" showDashboardLink={false} signedIn={signedIn} />
              </div>
              {/* Mobile menu button */}
              <Button
                variant="outline"
                size="icon"
                className="md:hidden h-9 w-9"
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

        {/* Mobile menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 border-t border-border/50",
            mobileOpen ? "max-h-60" : "max-h-0 border-t-0"
          )}
        >
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const linkEl = (
                <Link
                  key={link.href}
                  href={link.href as never}
                  className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
              if (!link.authGated) return linkEl;
              if (!mounted || !isSignedIn) return null;
              return linkEl;
            })}
            <div className="pt-2 px-3 sm:hidden">
              <HeaderAuth mode="modal" showDashboardLink={false} signedIn={signedIn} />
            </div>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}

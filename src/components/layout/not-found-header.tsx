"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PreferencesPopover } from "./preferences-popover";
import { NotFoundAuth } from "./not-found-auth";

interface NavLink {
  href: "/products" | "/brands";
  label: string;
}

/**
 * Lean header for the 404 page. Deliberately NOT the full PublicHeader:
 * an error page must stay cheap and robust, so it carries only logo, primary
 * nav, the language/theme/currency popover, and Clerk's auth UI
 * (<NotFoundAuth>). Clerk needs only <ClerkProvider> (no socket/query), so
 * the session/sign-in UI stays. The socket-backed chat and the cart/wishlist
 * drawers are intentionally absent; they'd pull a stack of providers that can
 * throw and fire expensive connections that have no business on an error page.
 *
 * All links navigate via full page load (see HardNavBoundary), which is the
 * only reliable way out of Next's not-found router state.
 */
export function NotFoundHeader() {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks: NavLink[] = [
    { href: "/products", label: t("nav.products") },
    { href: "/brands", label: t("nav.brands") },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 header-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          {/* flex-1 left rail keeps the center nav screen-centered */}
          <div className="flex flex-1 justify-start min-w-0">
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
                {t("header.tagline")}
              </span>
            </div>
          </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mirrors the left flex-1 rail from md up (to keep the desktop nav
              centered); below md the nav is hidden so this only needs its own
              content width, leaving the rest for the logo/tagline rail. */}
          <div className="flex flex-none md:flex-1 items-center justify-end gap-1 sm:gap-2">
            <PreferencesPopover />
            <div className="hidden md:flex items-center gap-2 ml-1">
              <NotFoundAuth />
            </div>
            {/* Mobile menu button - reveals nav (and auth on phones) once the
                inline nav/auth collapse below md. */}
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
            {/* Avatar-only below md (matching the hamburger's own md:hidden -
                a mismatched breakpoint here left the hamburger, not the
                avatar, as the rightmost element between sm and md), always
                the rightmost element, so it's obvious at a glance who's
                signed in even on the narrowest widths; the full controls
                take over at md - never both at once. */}
            <div className="md:hidden">
              <NotFoundAuth avatarOnly />
            </div>
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {/* hideAvatarWhenSignedIn: the avatar's already always visible in
              the header row (see avatarOnly above) - this only needs to
              offer sign-in/sign-up to a signed-out visitor. md:hidden to
              match avatarOnly's breakpoint above (not sm - this dropdown
              itself only exists below md anyway). */}
          <div className="pt-2 px-3 md:hidden">
            <NotFoundAuth hideAvatarWhenSignedIn />
          </div>
        </div>
      </div>
    </header>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderAuth } from "./header-auth";
import { ThemeSwitcher } from "./theme-switcher";
import { CartButton } from "@/features/cart/components/CartButton";
import { CartDrawer } from "@/features/cart/components/CartDrawer";
import { Store, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const baseNavLinks = [
  { href: "/products", label: "Products" },
  { href: "/dashboard", label: "Dashboard" },
];

const adminNavLink = { href: "/admin", label: "Admin" };

interface PublicHeaderProps {
  showAdminLink?: boolean;
}

export function PublicHeader({ showAdminLink = false }: PublicHeaderProps) {
  const navLinks = showAdminLink ? [...baseNavLinks, adminNavLink] : baseNavLinks;
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
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link
              href="/"
              className="group flex items-center gap-2.5 shrink-0"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-105">
                <Store className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight leading-tight">
                  Marketplace
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground leading-tight">
                  Enterprise Platform
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
                >
                  {link.label}
                  <span className="absolute inset-x-4 -bottom-px h-px bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeSwitcher />
              <CartButton />
              <div className="hidden sm:flex items-center gap-2 ml-1">
                <HeaderAuth mode="modal" showDashboardLink={false} />
              </div>
              {/* Mobile menu button */}
              <Button
                variant="ghost"
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
            <div className="pt-2 px-3 sm:hidden">
              <HeaderAuth mode="modal" showDashboardLink={false} />
            </div>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}

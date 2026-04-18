"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LucideIcon } from "lucide-react";

export interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarNavProps {
  title: string;
  links: SidebarLink[];
  extraLinks?: SidebarLink[];
  extraLinksTitle?: string;
  children?: React.ReactNode;
}

function NavContent({
  title,
  links,
  extraLinks,
  extraLinksTitle = "Quick Links",
  children,
  pathname,
  onNavigate,
}: SidebarNavProps & { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 px-3">
        {title}
      </h2>

      {children && <div className="mb-4">{children}</div>}

      <nav className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" &&
              link.href !== "/admin" &&
              link.href !== "/admin/products" &&
              pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-primary" : ""
                )}
              />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {extraLinks && extraLinks.length > 0 && (
        <>
          <div className="my-4 border-t border-border/50" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 px-3">
            {extraLinksTitle}
          </h2>
          <nav className="space-y-1">
            {extraLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href || pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : ""
                    )}
                  />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}

export function SidebarNav(props: SidebarNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border/50 bg-card/30 backdrop-blur-sm overflow-y-auto">
        <NavContent {...props} pathname={pathname} />
      </aside>

      {/* Mobile menu button + sheet */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed bottom-4 left-4 z-40 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">{props.title}</SheetTitle>
            <div className="overflow-y-auto h-full">
              <NavContent
                {...props}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
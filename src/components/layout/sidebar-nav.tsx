"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMobileBottomBarStore } from "@/store/mobileBottomBar";
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

function NavLinks({
  links,
  extraLinks,
  extraLinksTitle = "Quick Links",
  pathname,
  onNavigate,
}: Pick<SidebarNavProps, "links" | "extraLinks" | "extraLinksTitle"> & {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive =
          pathname === link.href ||
          (link.href !== "/dashboard" &&
            link.href !== "/admin" &&
            link.href !== "/admin/products" &&
            link.href !== "/dashboard/organization" &&
            pathname.startsWith(link.href));

        return (
          <Link
            key={link.href}
            href={link.href as never}
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

      {extraLinks && extraLinks.length > 0 && (
        <>
          <div className="my-4 border-t border-border/50" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-3">
            {extraLinksTitle}
          </h2>
          {extraLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href || pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href as never}
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
        </>
      )}
    </div>
  );
}

export function SidebarNav(props: SidebarNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // An edit form's inline save bar (ProductForm, BrandForm, ...) renders as a
  // full-width footer at the bottom of this same mobile viewport - shift the
  // trigger up to clear it instead of sitting on top of the Save/Discard
  // buttons. See mobileBottomBar.ts.
  const bottomBarPresent = useMobileBottomBarStore((s) => s.count > 0);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border/50 bg-card/30 backdrop-blur-xs">
        <div className="shrink-0 px-5 pt-5 pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3">
            {props.title}
          </h2>
          {props.children && <div className="mt-4">{props.children}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 -mt-1.5 pt-1.5">
          <NavLinks
            links={props.links}
            extraLinks={props.extraLinks}
            extraLinksTitle={props.extraLinksTitle}
            pathname={pathname}
          />
        </div>
      </aside>

      {/* Mobile menu button + sheet */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className={cn(
                "fixed left-4 z-40 h-12 w-12 rounded-full shadow-lg hover:brightness-110 transition-[bottom] duration-200",
                bottomBarPresent
                  ? "bottom-[calc(6rem+env(safe-area-inset-bottom))]"
                  : "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 flex flex-col p-0" aria-describedby={undefined}>
            <SheetTitle className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground px-8 pt-6 pb-3">
              {props.title}
            </SheetTitle>
            {props.children && (
              <div className="shrink-0 px-5 pb-3">{props.children}</div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-5 -mt-1.5 pt-1.5">
              <NavLinks
                links={props.links}
                extraLinks={props.extraLinks}
                extraLinksTitle={props.extraLinksTitle}
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
"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Store } from "lucide-react";

export function Footer() {
  const t = useTranslations("footer");

  const footerLinks = {
    [t("platform")]: [
      { label: t("products"), href: "/products" },
      { label: t("brands"), href: "/brands" },
      { label: t("pricing"), href: "#" },
    ],
    [t("company")]: [
      { label: t("about"), href: "#" },
      { label: t("blog"), href: "#" },
      { label: t("careers"), href: "#" },
    ],
    [t("legal")]: [
      { label: t("privacy"), href: "#" },
      { label: t("terms"), href: "#" },
      { label: t("cookies"), href: "#" },
    ],
  };

  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Marketplace
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("tagline")}
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href as never}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-border/50 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("crafted")}
          </p>
        </div>
      </div>
    </footer>
  );
}

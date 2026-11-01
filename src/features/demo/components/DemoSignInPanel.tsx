"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_ROLES, type DemoRole } from "../demoAccounts";
import { demoSignInHref } from "../demoSignInHref";

const ICON: Record<DemoRole, typeof ShoppingBag> = {
  buyer: ShoppingBag,
  seller: Store,
  admin: ShieldCheck,
};

/**
 * One-click sign-in as each public demo account, under Clerk's sign-in card.
 * Plain links, not client navigation: the target is a route handler that
 * answers with a redirect to Clerk.
 *
 * Carries the page sign-in interrupted (Clerk's `redirect_url`, e.g. checkout)
 * as `next`, so the visitor comes back to it - see demoReturnPath, which
 * decides whether the chosen role can use that page.
 */
export function DemoSignInPanel() {
  const t = useTranslations("demo");
  const locale = useLocale();
  const redirectUrl = useSearchParams().get("redirect_url");

  return (
    <section
      aria-labelledby="demo-sign-in-title"
      className="w-full max-w-100 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
    >
      <h2 id="demo-sign-in-title" className="text-base font-semibold">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="mt-4 space-y-2">
        {DEMO_ROLES.map((role) => {
          const Icon = ICON[role];
          return (
            <li key={role}>
              <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 py-2.5">
                <a href={demoSignInHref(role, locale, redirectUrl)}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col items-start text-left">
                    <span className="font-medium">{t(role)}</span>
                    <span className="text-xs font-normal whitespace-normal text-muted-foreground">
                      {t(`${role}Hint`)}
                    </span>
                  </span>
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

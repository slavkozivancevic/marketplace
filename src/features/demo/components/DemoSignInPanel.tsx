"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_ROLES, isDemoRole, type DemoRole } from "../demoAccounts";
import { demoSignInHref } from "../demoSignInHref";
import { DEMO_FOR_PARAM, demoRolesFor } from "../demoSignIn";
import { DemoSignInLink } from "./DemoSignInLink";

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
 * decides whether the chosen role can use that page. Only the roles that CAN
 * are offered (demoRolesFor, the same rule): from checkout that is the buyer
 * alone, where "Admin" used to sign in and land on the admin panel.
 *
 * The click REPLACES this page in history (DemoSignInLink). Left in place,
 * Back from wherever the demo landed returned here already signed in: the
 * panel painted, then Clerk bounced on to `redirect_url` - a flash of all
 * three offers before the page the visitor actually came from.
 */
export function DemoSignInPanel() {
  const t = useTranslations("demo");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const intent = searchParams.get(DEMO_FOR_PARAM);
  const roles = demoRolesFor(redirectUrl, DEMO_ROLES, isDemoRole(intent) ? intent : null);

  return (
    <section
      aria-labelledby="demo-sign-in-title"
      className="w-full max-w-100 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
    >
      <h2 id="demo-sign-in-title" className="text-base font-semibold">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      {roles.length < DEMO_ROLES.length && (
        <p className="mt-2 text-sm text-muted-foreground">{t("onlyRolesForPage")}</p>
      )}
      <ul className="mt-4 space-y-2">
        {roles.map((role) => {
          const Icon = ICON[role];
          const href = demoSignInHref(role, locale, redirectUrl);
          return (
            <li key={role}>
              <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 py-2.5">
                <DemoSignInLink href={href}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col items-start text-left">
                    <span className="font-medium">{t(role)}</span>
                    <span className="text-xs font-normal whitespace-normal text-muted-foreground">
                      {t(`${role}Hint`)}
                    </span>
                  </span>
                </DemoSignInLink>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

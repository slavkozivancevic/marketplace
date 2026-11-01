"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDemoReadOnly } from "../useDemoReadOnly";
import { demoSignInHref } from "../demoSignInHref";

/**
 * Stands in for a buyer action (cart, wishlist, checkout, chat) while the demo
 * seller or the demo admin is signed in, and offers the account that can do
 * it. A plain link, not client navigation: the target is a route handler that
 * signs this account out and the visitor's own demo buyer in.
 */
export function DemoBuyerOnlyNotice({ className }: { className?: string }) {
  const t = useTranslations("demo");
  const locale = useLocale();
  // The page this notice sits on, so the buyer lands back on it (the product
  // they were looking at, the cart) instead of on the buyer's home.
  const pathname = usePathname();

  return (
    <Alert className={className}>
      <Info />
      <AlertDescription>
        <p>{t("buyerOnly")}</p>
        {/* AlertDescription underlines links in running text, and its
            descendant selector outranks a plain class - this one is a button. */}
        <Button asChild variant="outline" className="no-underline!">
          <a href={demoSignInHref("buyer", locale, pathname)}>{t("signInAsBuyer")}</a>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * A whole buyer surface (cart, checkout, chat) for everyone but the demo seller
 * and admin, who get the notice in its place - centred in whatever room the
 * surface had, so a drawer or a page keeps its frame.
 */
export function DemoBuyerOnlyGate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const demoReadOnly = useDemoReadOnly();
  if (!demoReadOnly) return children;
  return <DemoBuyerOnlyPanel className={className} />;
}

/** The notice centred in the room a buyer surface would have filled. */
export function DemoBuyerOnlyPanel({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-1 items-center justify-center p-6", className)}>
      <DemoBuyerOnlyNotice className="max-w-md" />
    </div>
  );
}

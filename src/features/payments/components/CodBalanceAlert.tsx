"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Wallet, ChevronDown } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

/**
 * The running COD balance, which points both ways.
 *
 * Positive is commission this seller owes us and will have withheld from their
 * next payout. Negative is the reverse - a coupon on a cash-on-delivery order
 * that ran deeper than our commission on it, so they collected less at the door
 * than they earned and we owe them the difference (markCodPaymentReceived).
 *
 * The two get separate banners rather than one signed number. "You owe" with a
 * minus in front of it is not something anyone should have to decode about their
 * own money, and the sentence explaining each direction is a different sentence.
 */
export function CodBalanceAlert({
  balances,
}: {
  balances: { currency: string; owedAmount: number }[];
}) {
  const owed = balances.filter((b) => b.owedAmount > 0);
  const credited = balances.filter((b) => b.owedAmount < 0);

  return (
    <>
      {owed.length > 0 && <BalanceBanner balances={owed} kind="owed" />}
      {credited.length > 0 && (
        <BalanceBanner
          balances={credited.map((b) => ({ ...b, owedAmount: -b.owedAmount }))}
          kind="credit"
        />
      )}
    </>
  );
}

function BalanceBanner({
  balances,
  kind,
}: {
  /** Always positive here - direction is carried by `kind`, not by the sign. */
  balances: { currency: string; owedAmount: number }[];
  kind: "owed" | "credit";
}) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  // The amount is the only thing worth seeing at a glance - the explanation
  // paragraph stays collapsed by default so this banner doesn't compete with the
  // payout table for vertical space on short screens.
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Alert className="shrink-0">
        <Wallet className="h-4 w-4" />
        <AlertTitle>{t(kind === "owed" ? "codBalanceTitle" : "codCreditTitle")}</AlertTitle>
        <AlertAction>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
              <span className="sr-only">{t("toggleDetails")}</span>
            </Button>
          </CollapsibleTrigger>
        </AlertAction>
        <AlertDescription>
          <div className="space-y-1">
            {balances.map((b) => (
              <div key={b.currency} className="font-semibold">
                {formatPrice(b.owedAmount, b.currency as Currency, locale)}
              </div>
            ))}
          </div>
          <CollapsibleContent>
            <p className="mt-1">{t(kind === "owed" ? "codBalanceDesc" : "codCreditDesc")}</p>
          </CollapsibleContent>
        </AlertDescription>
      </Alert>
    </Collapsible>
  );
}
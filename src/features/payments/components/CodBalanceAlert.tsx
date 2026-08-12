"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

export function CodBalanceAlert({
  balances,
}: {
  balances: { currency: string; owedAmount: number }[];
}) {
  const t = useTranslations("payouts");
  // The owed amount is the only thing worth seeing at a glance - the
  // explanation paragraph stays collapsed by default so this banner doesn't
  // compete with the payout table for vertical space on short screens.
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Alert className="shrink-0">
        <Wallet className="h-4 w-4" />
        <AlertTitle>{t("codBalanceTitle")}</AlertTitle>
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
                {formatPrice(b.owedAmount, b.currency as Currency)}
              </div>
            ))}
          </div>
          <CollapsibleContent>
            <p className="mt-1">{t("codBalanceDesc")}</p>
          </CollapsibleContent>
        </AlertDescription>
      </Alert>
    </Collapsible>
  );
}
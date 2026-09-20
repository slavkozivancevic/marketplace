"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { formatPrice } from "@/lib/currency";
import { MoneyField } from "@/components/forms/MoneyField";
import type { MoneyInput } from "@/lib/money-input";
import type { Currency } from "@/lib/currency-config";
import type { AdminCodBalanceItem } from "../db/payouts";
import { settleCodBalanceAction, payOutCodCreditAction } from "../actions/codBalance";
// Grid template is owned by the skeleton module so the two can never drift.
import { COD_BALANCES_COLS as GRID } from "./AdminCodBalancesSkeleton";

/**
 * One dialog, two directions. A positive balance is commission to collect from
 * the seller; a negative one is a credit to hand back (a COD coupon deeper than
 * the commission on it). The arithmetic is identical - an amount, clamped to
 * what is outstanding - so splitting this in two would have duplicated the
 * clamping and the pending behaviour just to change four labels.
 */
function SettleDialog({
  item,
  kind,
  isPending,
  onSettle,
  onCancel,
}: {
  item: AdminCodBalanceItem;
  kind: "settle" | "credit";
  /**
   * Settling is driven by the list, not by this dialog: the balance it changes
   * is a row in that list, and a dialog that closes itself cannot wait for the
   * row to catch up. The list keeps this open, spinner and all, until the new
   * amount is on screen.
   */
  isPending: boolean;
  onSettle: (amount: number) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("adminCodBalances");
  const locale = useLocale();
  const tc = useTranslations("common");
  // A COD balance is denominated in the order's currency, not the admin's
  // display preference, so the field is locked to it. It also means the amount
  // is already in that currency's minor units - there is nothing to convert.
  const balanceCurrency = item.currency as Currency;
  // Direction lives in `kind`; the amount typed is always a positive figure.
  const outstanding = Math.abs(item.owedAmount);
  const [amount, setAmount] = useState<MoneyInput>({
    currency: balanceCurrency,
    amount: outstanding,
  });
  const maxAmount = outstanding;
  const parsed = amount.amount;
  // The server also clamps (settleCodBalance never lets the balance go
  // negative), but silently accepting and rounding down a too-high entry here
  // would look like the app ignored what the admin typed - reject it instead
  // so they see exactly why the amount changed, or don't submit at all.
  const tooHigh = Number.isFinite(parsed) && parsed > maxAmount;
  const valid = Number.isFinite(parsed) && parsed > 0 && !tooHigh;

  const handleConfirm = () => {
    if (!valid) return;
    onSettle(parsed);
  };

  return (
    <Dialog open onOpenChange={(next) => !isPending && !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(kind === "settle" ? "settleTitle" : "payTitle", {
              org: item.organizationName,
            })}
          </DialogTitle>
          <DialogDescription>
            {t(kind === "settle" ? "settleDesc" : "payDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="settle-amount">
            {t(kind === "settle" ? "amountLabel" : "amountPaidLabel")}
          </Label>
          <MoneyField
            lockedCurrency={balanceCurrency}
            aria-invalid={tooHigh}
            value={amount}
            onChange={setAmount}
            disabled={isPending}
            rates={{}}
          />
          {tooHigh ? (
            <p className="text-xs text-destructive">
              {t(kind === "settle" ? "amountTooHigh" : "amountTooHighCredit")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t(kind === "settle" ? "owedNow" : "creditNow", {
                amount: formatPrice(outstanding, item.currency as Currency, locale),
              })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={onCancel}>
            {tc("cancel")}
          </Button>
          <Button disabled={isPending || !valid} onClick={handleConfirm}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending
              ? t(kind === "settle" ? "settling" : "paying")
              : t("confirmSettle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCodBalances({ items }: { items: AdminCodBalanceItem[] }) {
  const t = useTranslations("adminCodBalances");
  const locale = useLocale();
  const router = useRouter();
  const [target, setTarget] = useState<AdminCodBalanceItem | null>(null);
  const [isSettling, startSettle] = useTransition();
  const announceSettled = useAnnounceWhenSettled(isSettling);

  // Which way the money goes is read off the balance itself, not off which
  // button was pressed - the row only offers the one that makes sense for it.
  const handleSettle = (item: AdminCodBalanceItem, amount: number) => {
    const isCredit = item.owedAmount < 0;
    startSettle(async () => {
      const res = isCredit
        ? await payOutCodCreditAction(item.organizationId, item.currency, amount)
        : await settleCodBalanceAction(item.organizationId, item.currency, amount);
      if ("error" in res) {
        // Leave the dialog open so the reason stays readable next to the amount
        // that caused it.
        toast.error(res.message);
        return;
      }
      // The owed amount on the row behind this dialog is server-rendered, so it
      // only moves once the page re-renders. Refreshing inside this transition
      // keeps the dialog up with its spinner until then, and closes it in the
      // same commit that shows the new balance - with the toast.
      announceSettled({
        message: t(isCredit ? "paidOut" : "settled", {
          amount: formatPrice(
            "paid" in res ? res.paid : res.settled,
            item.currency as Currency,
            locale,
          ),
        }),
      });
      router.refresh();
      setTarget(null);
    });
  };

  if (items.length === 0) {
    return (
      <Alert>
        <AlertTitle>{t("empty")}</AlertTitle>
        <AlertDescription>{t("emptyDesc")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-lg border flex-1 min-h-0 overflow-auto">
      <div
        role="row"
        className={cn(GRID, "border-b p-3 text-sm font-medium text-muted-foreground sticky top-0 z-10 bg-background min-w-fit")}
      >
        <div role="columnheader">{t("organization")}</div>
        <div role="columnheader">{t("currency")}</div>
        <div role="columnheader" className="text-right">{t("owed")}</div>
        <div role="columnheader">{t("actions")}</div>
      </div>
      {items.map((item) => (
        <div
          key={`${item.organizationId}-${item.currency}`}
          role="row"
          className={cn(GRID, "border-b p-3 text-sm min-w-fit")}
        >
          <div className="font-medium truncate">{item.organizationName}</div>
          <div className="uppercase text-muted-foreground">{item.currency}</div>
          {/* A negative balance is the platform owing the seller - a COD coupon
              that ran deeper than the commission on it. Shown as its own thing,
              not as a minus sign in a column headed "owed", because the two are
              opposite directions of money and an admin skimming the list would
              read the sign as a typo. */}
          <div
            className={cn(
              "text-right font-semibold tabular-nums",
              item.owedAmount < 0 && "text-emerald-600 dark:text-emerald-500",
            )}
          >
            {item.owedAmount < 0
              ? t("weOwe", {
                  amount: formatPrice(-item.owedAmount, item.currency as Currency, locale),
                })
              : formatPrice(item.owedAmount, item.currency as Currency, locale)}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setTarget(item)}>
              {item.owedAmount > 0 ? t("settle") : t("payAction")}
            </Button>
            {/* A credit normally needs no action at all - it leaves with the
                seller's next Stripe transfer. The button is for the seller who
                never gets one (cash-on-delivery only), whose money would
                otherwise sit here forever. */}
            {item.owedAmount < 0 && (
              <span className="text-xs text-muted-foreground">{t("creditNote")}</span>
            )}
          </div>
        </div>
      ))}
      {target && (
        <SettleDialog
          item={target}
          kind={target.owedAmount < 0 ? "credit" : "settle"}
          isPending={isSettling}
          onSettle={(amount) => handleSettle(target, amount)}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatPrice, centsToDecimal, decimalToCents } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import type { AdminCodBalanceItem } from "../db/payouts";
import { settleCodBalanceAction } from "../actions/codBalance";

const GRID = "grid grid-cols-[minmax(160px,2fr)_100px_150px_140px] items-center gap-4";

function SettleDialog({
  item,
  onClose,
}: {
  item: AdminCodBalanceItem;
  onClose: (settled: boolean) => void;
}) {
  const t = useTranslations("adminCodBalances");
  const tc = useTranslations("common");
  const [amount, setAmount] = useState(String(centsToDecimal(item.owedAmount)));
  const [isPending, startTransition] = useTransition();

  const maxAmount = centsToDecimal(item.owedAmount);
  const parsed = Number(amount);
  // The server also clamps (settleCodBalance never lets the balance go
  // negative), but silently accepting and rounding down a too-high entry here
  // would look like the app ignored what the admin typed - reject it instead
  // so they see exactly why the amount changed, or don't submit at all.
  const tooHigh = Number.isFinite(parsed) && parsed > maxAmount;
  const valid = Number.isFinite(parsed) && parsed > 0 && !tooHigh;

  const handleConfirm = () => {
    if (!valid) return;
    startTransition(async () => {
      const res = await settleCodBalanceAction(
        item.organizationId,
        item.currency,
        decimalToCents(parsed),
      );
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      toast.success(
        t("settled", { amount: formatPrice(res.settled, item.currency as Currency) }),
      );
      onClose(true);
    });
  };

  return (
    <Dialog open onOpenChange={(next) => !isPending && !next && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settleTitle", { org: item.organizationName })}</DialogTitle>
          <DialogDescription>{t("settleDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="settle-amount">{t("amountLabel")}</Label>
          <Input
            id="settle-amount"
            type="number"
            min="0.01"
            step="0.01"
            max={maxAmount}
            aria-invalid={tooHigh}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
          />
          {tooHigh ? (
            <p className="text-xs text-destructive">{t("amountTooHigh")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("owedNow", { amount: formatPrice(item.owedAmount, item.currency as Currency) })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onClose(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={isPending || !valid} onClick={handleConfirm}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? t("settling") : t("confirmSettle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCodBalances({ items }: { items: AdminCodBalanceItem[] }) {
  const t = useTranslations("adminCodBalances");
  const router = useRouter();
  const [target, setTarget] = useState<AdminCodBalanceItem | null>(null);

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
          <div className="text-right font-semibold tabular-nums">
            {formatPrice(item.owedAmount, item.currency as Currency)}
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={() => setTarget(item)}>
              {t("settle")}
            </Button>
          </div>
        </div>
      ))}
      {target && (
        <SettleDialog
          item={target}
          onClose={(settled) => {
            setTarget(null);
            if (settled) router.refresh();
          }}
        />
      )}
    </div>
  );
}

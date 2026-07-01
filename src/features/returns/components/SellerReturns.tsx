"use client";

import { useState, useTransition } from "react";
import { useRefreshOrderViews } from "@/features/orders/hooks/useRefreshOrderViews";
import { useTranslations } from "next-intl";
import { Loader2, RotateCcw, Check, X, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { approveReturn, rejectReturn, refundReturn } from "@/features/returns/actions/returns";
import type { ActionErrorResult } from "@/types/types";

type ReturnLine = {
  orderItemId: string;
  title: string;
  variantLabel: string | null;
  quantity: number;
};

type ReturnRow = {
  id: string;
  status: string;
  reason: string | null;
  resolutionNote: string | null;
  refundAmount: number | null;
  createdAt: Date;
  items: ReturnLine[];
};

function statusVariant(s: string) {
  if (s === "REFUNDED") return "default" as const;
  if (s === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export function SellerReturns({
  returns,
  currency,
}: {
  returns: ReturnRow[];
  currency: string;
}) {
  const t = useTranslations("returns");
  const refreshOrderViews = useRefreshOrderViews();
  const [isPending, start] = useTransition();
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // A single transition drives every row's buttons, so track which return + which
  // action is in flight to swap only that button's label/spinner (not its siblings).
  const [pending, setPending] = useState<{ id: string; kind: "approve" | "reject" | "refund" } | null>(null);
  const isRunning = (id: string, kind: "approve" | "reject" | "refund") =>
    isPending && pending?.id === id && pending?.kind === kind;

  if (returns.length === 0) return null;

  const statusLabel: Record<string, string> = {
    REQUESTED: t("statusRequested"),
    APPROVED: t("statusApproved"),
    REJECTED: t("statusRejected"),
    SHIPPED: t("statusShipped"),
    REFUNDED: t("statusRefunded"),
  };

  const run = (
    action: { id: string; kind: "approve" | "reject" | "refund" },
    fn: () => Promise<{ ok: true } | ActionErrorResult>,
    ok: string,
  ) => {
    setPending(action);
    start(async () => {
      const res = await fn();
      if ("error" in res) {
        toast.error(res.message);
        setPending(null);
        return;
      }
      toast.success(ok);
      setRejectFor(null);
      setNote("");
      // Leave `pending` set: refreshOrderViews() re-renders this row with its new
      // status, which unmounts the button - clearing it here would blink the label
      // back to idle in that gap.
      refreshOrderViews();
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          {t("sellerTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        {returns.map((r, index) => (
          <div key={r.id}>
            {index > 0 && <Separator className="my-3" />}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <Badge variant={statusVariant(r.status)} className="w-fit text-[10px]">
                  {statusLabel[r.status] ?? r.status}
                </Badge>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {r.items.map((l) => (
                    <li key={l.orderItemId}>
                      {l.variantLabel ? `${l.title} (${l.variantLabel})` : l.title} × {l.quantity}
                    </li>
                  ))}
                </ul>
                {r.reason && (
                  <span className="text-xs text-muted-foreground">
                    {t("reasonLabel")}: {r.reason}
                  </span>
                )}
                {r.status === "REFUNDED" && r.refundAmount != null && (
                  <span className="text-xs text-muted-foreground">
                    {t("refunded")}: {formatPrice(r.refundAmount, currency as Currency)}
                  </span>
                )}
              </div>

              <div className="shrink-0 flex gap-2">
                {r.status === "REQUESTED" && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={isPending}
                      onClick={() => run({ id: r.id, kind: "approve" }, () => approveReturn(r.id), t("approved"))}>
                      {isRunning(r.id, "approve") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {isRunning(r.id, "approve") ? t("approving") : t("approve")}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" disabled={isPending}
                      onClick={() => setRejectFor(rejectFor === r.id ? null : r.id)}>
                      <X className="h-3.5 w-3.5" />
                      {t("reject")}
                    </Button>
                  </>
                )}
                {r.status === "SHIPPED" && (
                  <Button size="sm" className="gap-1.5" disabled={isPending}
                    onClick={() => run({ id: r.id, kind: "refund" }, () => refundReturn(r.id), t("refundDone"))}>
                    {isRunning(r.id, "refund") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeDollarSign className="h-3.5 w-3.5" />}
                    {isRunning(r.id, "refund") ? t("refunding") : t("markRefunded")}
                  </Button>
                )}
              </div>
            </div>

            {rejectFor === r.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={2}
                  placeholder={t("rejectReasonPlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="gap-1.5" disabled={isPending}
                    onClick={() => run({ id: r.id, kind: "reject" }, () => rejectReturn(r.id, note.trim() || undefined), t("rejected"))}>
                    {isRunning(r.id, "reject") && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isRunning(r.id, "reject") ? t("rejecting") : t("confirmReject")}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={isPending}
                    onClick={() => { setRejectFor(null); setNote(""); }}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

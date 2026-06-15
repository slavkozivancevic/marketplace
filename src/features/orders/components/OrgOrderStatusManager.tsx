"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, XCircle, Loader2, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateOrgOrderStatus, markCodPaymentReceived } from "../actions/updateOrgOrderStatus";
import { useRefreshOrderViews } from "../hooks/useRefreshOrderViews";

function CancelOrderButton({
  onConfirm,
  disabled,
  loading,
}: {
  onConfirm: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const t = useTranslations("orgOrders");
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return; // keep the dialog open while the action runs
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          <XCircle className="mr-2 h-4 w-4" />
          {t("cancelOrder")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("cancelConfirmDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("keepOrder")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            variant="destructiveSolid"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("cancellingOrder")}
              </>
            ) : (
              t("cancelOrder")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface OrgOrderStatusManagerProps {
  orderId: string;
  currentStatus: string;
}

export function OrgOrderStatusManager({
  orderId,
  currentStatus,
}: OrgOrderStatusManagerProps) {
  const t = useTranslations("orgOrders");
  const refreshOrderViews = useRefreshOrderViews();
  // The in-flight action drives the button spinners. Loading is NOT tied to a
  // useTransition flag, so it can't blink off before the component unmounts.
  const [activeAction, setActiveAction] = useState<"complete" | "cancel" | "paid" | null>(null);
  const busy = activeAction !== null;

  // Delivery is marked while PENDING_COD; payment is confirmed while the order
  // sits in AWAITING_PAYMENT (delivered, cash not yet confirmed). Confirming
  // payment is what completes the order.
  const showDelivery = currentStatus === "PENDING_COD";
  const showPaymentReceived = currentStatus === "AWAITING_PAYMENT";
  if (!showDelivery && !showPaymentReceived) return null;

  // Delivery keeps the component mounted (the card swaps to the payment step), so
  // we clear the spinner after success. Cancel and payment move the order out of
  // this card entirely - leave the spinner on until the component unmounts so the
  // button doesn't flash back to its idle state first.
  const handleDeliver = async () => {
    setActiveAction("complete");
    const result = await updateOrgOrderStatus(orderId, "AWAITING_PAYMENT");
    if ("error" in result) {
      toast.error(result.error);
      setActiveAction(null);
      return;
    }
    toast.success(t("markedComplete"));
    setActiveAction(null);
    refreshOrderViews();
  };

  const handlePaymentReceived = async () => {
    setActiveAction("paid");
    const result = await markCodPaymentReceived(orderId);
    if ("error" in result) {
      toast.error(result.error);
      setActiveAction(null);
      return;
    }
    toast.success(t("markedPaymentReceived"));
    refreshOrderViews();
  };

  const handleCancel = async () => {
    setActiveAction("cancel");
    const result = await updateOrgOrderStatus(orderId, "CANCELLED");
    if ("error" in result) {
      toast.error(result.error);
      setActiveAction(null);
      return;
    }
    toast.success(t("markedCancelled"));
    refreshOrderViews();
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-800 dark:text-amber-300">
          {t("actionRequired")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showDelivery && (
          <>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t("codActionDescription")}
            </p>
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={handleDeliver}
                disabled={busy}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {activeAction === "complete" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {t("markComplete")}
              </Button>
              <CancelOrderButton
                onConfirm={handleCancel}
                disabled={busy}
                loading={activeAction === "cancel"}
              />
            </div>
          </>
        )}

        {showPaymentReceived && (
          <>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t("codPaymentDescription")}
            </p>
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={handlePaymentReceived}
                disabled={busy}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {activeAction === "paid" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BadgeDollarSign className="mr-2 h-4 w-4" />
                )}
                {t("markPaymentReceived")}
              </Button>
              <CancelOrderButton
                onConfirm={handleCancel}
                disabled={busy}
                loading={activeAction === "cancel"}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

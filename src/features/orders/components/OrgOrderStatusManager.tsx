"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { XCircle, Loader2, BadgeDollarSign } from "lucide-react";
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
import { markCodPaymentReceived, cancelOrder } from "../actions/updateOrgOrderStatus";
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
  paymentMethod: "STRIPE" | "COD";
  paymentStatus: "UNPAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
  fulfillmentStatus: "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "DELIVERED";
}

export function OrgOrderStatusManager({
  orderId,
  paymentMethod,
  paymentStatus,
  fulfillmentStatus,
}: OrgOrderStatusManagerProps) {
  const t = useTranslations("orgOrders");
  const refreshOrderViews = useRefreshOrderViews();
  // The in-flight action drives the button spinners. Loading is NOT tied to a
  // useTransition flag, so it can't blink off before the component unmounts.
  const [activeAction, setActiveAction] = useState<"cancel" | "paid" | null>(null);
  const busy = activeAction !== null;

  // Clear the spinner only once the refreshed axes have actually landed, so a
  // button never blinks back to its idle state in the gap between the action
  // finishing and router.refresh() re-rendering with the new state.
  const stage = `${paymentStatus}:${fulfillmentStatus}`;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveAction(null);
  }, [stage]);

  // Shipping + delivery live in the ShipmentManager (per-seller). This card is
  // the order-level money step: collect COD cash once the whole order is
  // delivered, and cancel an unpaid COD order.
  const isCod = paymentMethod === "COD";
  const showPaymentReceived = isCod && paymentStatus === "UNPAID" && fulfillmentStatus === "DELIVERED";
  const showCancel = isCod && paymentStatus === "UNPAID";
  if (!showPaymentReceived && !showCancel) return null;

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
    const result = await cancelOrder(orderId);
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
        {showPaymentReceived && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {t("codPaymentDescription")}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {showPaymentReceived && (
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
          )}

          {showCancel && (
            <CancelOrderButton
              onConfirm={handleCancel}
              disabled={busy}
              loading={activeAction === "cancel"}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

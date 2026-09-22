"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { XCircle, Loader2, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/ActionButton";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { markCodPaymentReceived, cancelOrder } from "../actions/updateOrgOrderStatus";
import { useRefreshOrderViews } from "../hooks/useRefreshOrderViews";

/**
 * `open` is owned by the parent so the confirmation survives the refresh that a
 * cancel kicks off. It is never closed by hand on success: the refresh unmounts
 * the whole card - the part is cancelled, there is nothing left to act on - and
 * the dialog goes with it, in the very commit that raises the toast. Dismissing
 * it earlier would drop the seller back onto a page that still showed the order
 * as live.
 */
function CancelOrderButton({
  open,
  onOpenChange,
  onConfirm,
  disabled,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const t = useTranslations("orgOrders");
  return (
    <ActionButton
      open={open}
      onOpenChange={onOpenChange}
      title={t("cancelConfirmTitle")}
      description={t("cancelConfirmDesc")}
      confirmText={t("cancelOrder")}
      loadingText={t("cancellingOrder")}
      cancelText={t("keepOrder")}
      isLoading={loading}
      onConfirm={onConfirm}
    >
      {/* Resting control - the dialog's confirm button carries the spinner.
          `disabled` covers the other actions on this card, not this one. */}
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        className="border-destructive text-destructive pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive"
      >
        <XCircle className="mr-2 h-4 w-4" />
        {t("cancelOrder")}
      </Button>
    </ActionButton>
  );
}

interface OrgOrderStatusManagerProps {
  orderId: string;
  paymentMethod: "STRIPE" | "COD";
  /** This seller's own part was delivered - not the whole order. */
  partDelivered: boolean;
  /** This seller already confirmed it collected its own COD cash. */
  partSettled: boolean;
  /** This seller already withdrew its own goods from the order. */
  partCancelled: boolean;
  /** Order-level money axis - a refunded order is closed to everyone. */
  orderPaymentStatus: "UNPAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
}

export function OrgOrderStatusManager({
  orderId,
  paymentMethod,
  partDelivered,
  partSettled,
  partCancelled,
  orderPaymentStatus,
}: OrgOrderStatusManagerProps) {
  const t = useTranslations("orgOrders");
  const refreshOrderViews = useRefreshOrderViews();
  // Two transitions, one per button, so a spinner belongs to the control that was
  // clicked. Each stays pending until the router refresh inside it has been
  // applied - that commit is the one where this card changes or goes away, so a
  // button can never blink back to idle in between.
  const [isSettling, startSettle] = useTransition();
  const [isCancelling, startCancel] = useTransition();
  const announceSettled = useAnnounceWhenSettled(isSettling);
  const announceCancelled = useAnnounceWhenSettled(isCancelling);
  const [cancelOpen, setCancelOpen] = useState(false);
  const busy = isSettling || isCancelling;

  // Shipping + delivery live in the ShipmentManager. This card is the money step,
  // and both halves of it are per-seller: collect the cash for YOUR items once
  // YOU have delivered them, and withdraw YOUR items while nothing is paid.
  // Neither ever reaches another seller's goods in the same order.
  const isCod = paymentMethod === "COD";
  const unpaid = orderPaymentStatus === "UNPAID";
  const live = isCod && unpaid && !partCancelled;
  const showPaymentReceived = live && partDelivered && !partSettled;
  const showCancel = live && !partSettled;

  const handlePaymentReceived = () => {
    startSettle(async () => {
      const result = await markCodPaymentReceived(orderId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      announceSettled({ message: t("markedPaymentReceived") });
      refreshOrderViews();
    });
  };

  const handleCancel = () => {
    startCancel(async () => {
      const result = await cancelOrder(orderId);
      if ("error" in result) {
        // Left open on failure: the seller can read the reason and retry or back
        // out, rather than having the dialog vanish under an error toast.
        toast.error(result.error);
        return;
      }
      // No manual close: the refresh below takes the card, the button and this
      // dialog with it, and the toast lands in that same commit.
      announceCancelled({ message: t("markedCancelled") });
      refreshOrderViews();
    });
  };

  // Rendered after the handlers on purpose. The page keeps this component mounted
  // even once there is nothing left to act on, because the cancel it just ran is
  // what empties it - unmounting the announcer along with its own result would
  // swallow the confirmation. See the render site in the org order detail page.
  if (!showPaymentReceived && !showCancel) return null;

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
              variant="successSolid"
              size="sm"
              onClick={handlePaymentReceived}
              disabled={busy}
            >
              {isSettling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BadgeDollarSign className="mr-2 h-4 w-4" />
              )}
              {isSettling ? t("markingPaymentReceived") : t("markPaymentReceived")}
            </Button>
          )}

          {showCancel && (
            <CancelOrderButton
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              onConfirm={handleCancel}
              disabled={busy}
              loading={isCancelling}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

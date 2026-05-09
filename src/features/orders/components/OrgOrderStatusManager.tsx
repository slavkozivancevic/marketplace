"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrgOrderStatus } from "../actions/updateOrgOrderStatus";

interface OrgOrderStatusManagerProps {
  orderId: string;
  currentStatus: string;
}

export function OrgOrderStatusManager({ orderId, currentStatus }: OrgOrderStatusManagerProps) {
  const t = useTranslations("orgOrders");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<"complete" | "cancel" | null>(null);

  if (currentStatus !== "PENDING_COD") return null;

  const handleAction = (action: "complete" | "cancel") => {
    const newStatus = action === "complete" ? "COMPLETED" : "CANCELLED";
    setActiveAction(action);
    startTransition(async () => {
      const result = await updateOrgOrderStatus(orderId, newStatus);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          action === "complete" ? t("markedComplete") : t("markedCancelled"),
        );
        router.refresh();
      }
      setActiveAction(null);
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-800 dark:text-amber-300">
          {t("actionRequired")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t("codActionDescription")}
        </p>
        <div className="flex gap-3">
          <Button
            size="sm"
            onClick={() => handleAction("complete")}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isPending && activeAction === "complete" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            {t("markComplete")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("cancel")}
            disabled={isPending}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {isPending && activeAction === "cancel" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            {t("cancelOrder")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
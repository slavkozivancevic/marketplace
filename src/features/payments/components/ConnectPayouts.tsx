"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import {
  startConnectOnboarding,
  type ConnectStatus,
} from "@/features/payments/actions/connect";

export function ConnectPayouts({ status }: { status: ConnectStatus }) {
  const t = useTranslations("payouts");
  const [isPending, start] = useTransition();
  // Stays true from a successful action until the browser actually navigates, so
  // the button doesn't flicker back to its idle state in the gap between the
  // transition ending and the page reload landing.
  const [redirecting, setRedirecting] = useState(false);
  const busy = isPending || redirecting;

  const fullyEnabled = status.chargesEnabled && status.payoutsEnabled;
  // Onboarding started but Stripe still needs info, or is reviewing it.
  const pendingReview = status.connected && status.detailsSubmitted && !fullyEnabled;
  const incomplete = status.connected && !status.detailsSubmitted;

  const onConnect = () => {
    start(async () => {
      const res = await startConnectOnboarding();
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      setRedirecting(true);
      window.location.href = res.url;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {t("title")}
        </CardTitle>
        {fullyEnabled ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("statusActive")}
          </Badge>
        ) : pendingReview ? (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("statusPending")}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {t("statusNotConnected")}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{t("description")}</p>

        {fullyEnabled && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t("activeTitle")}</AlertTitle>
            <AlertDescription>{t("activeDesc")}</AlertDescription>
          </Alert>
        )}

        {pendingReview && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>{t("pendingTitle")}</AlertTitle>
            <AlertDescription>{t("pendingDesc")}</AlertDescription>
          </Alert>
        )}

        {!fullyEnabled && (
          <Button onClick={onConnect} disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy
              ? t("connecting")
              : incomplete || pendingReview
                ? t("continueOnboarding")
                : t("connectStripe")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

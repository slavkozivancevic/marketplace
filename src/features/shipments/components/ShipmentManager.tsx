"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Truck, CheckCircle2, Pencil, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { markShipped, markDelivered } from "@/features/shipments/actions/shipments";
import { useRefreshOrderViews } from "@/features/orders/hooks/useRefreshOrderViews";

type Shipment = {
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date;
  deliveredAt: Date | null;
} | null;

const COMMON_CARRIERS = ["DHL", "UPS", "FedEx", "GLS", "PostNL", "Post Express", "BEX", "DExpress"];

export function ShipmentManager({
  orderId,
  shipment,
}: {
  orderId: string;
  shipment: Shipment;
}) {
  const t = useTranslations("shipments");
  const locale = useLocale();
  const dl = dateLocale(locale);
  const refreshOrderViews = useRefreshOrderViews();
  const [isPending, start] = useTransition();
  const [isDelivering, startDeliver] = useTransition();
  const [editing, setEditing] = useState(false);
  const [carrier, setCarrier] = useState(shipment?.carrier ?? "");
  const [tracking, setTracking] = useState(shipment?.trackingNumber ?? "");

  // Reset any half-typed draft when the route changes. The client Router Cache
  // (dynamicOnHover) keeps this component's state alive across instant back-nav,
  // so without this an unsaved carrier/tracking would linger when you return.
  const pathname = usePathname();
  useEffect(() => {
    setCarrier(shipment?.carrier ?? "");
    setTracking(shipment?.trackingNumber ?? "");
    setEditing(false);
    // Intentionally keyed on pathname only - sync back to the server values
    // whenever we navigate to/away from this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const submit = () => {
    start(async () => {
      const res = await markShipped(orderId, tracking.trim() || undefined, carrier.trim() || undefined);
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      toast.success(shipment ? t("trackingUpdated") : t("markedShipped"));
      setEditing(false);
      // Invalidate the order lists + status-filter counts (not just the server
      // page) so SHIPPED/DELIVERED counts update immediately.
      refreshOrderViews();
    });
  };

  const confirmDelivered = () => {
    startDeliver(async () => {
      const res = await markDelivered(orderId);
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      toast.success(t("markedDelivered"));
      refreshOrderViews();
    });
  };

  const delivered = !!shipment?.deliveredAt;
  const showForm = !shipment || editing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4" />
          {t("title")}
        </CardTitle>
        {delivered ? (
          <Badge variant="default" className="gap-1">
            <PackageCheck className="h-3 w-3" />
            {t("delivered")}
          </Badge>
        ) : shipment ? (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("shipped")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("unfulfilled")}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {shipment && !editing && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">
              {t("shippedOn", {
                date: new Date(shipment.shippedAt).toLocaleDateString(dl, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
              })}
            </p>
            {shipment.carrier && (
              <p>
                <span className="text-muted-foreground">{t("carrier")}: </span>
                {shipment.carrier}
              </p>
            )}
            {shipment.trackingNumber && (
              <p>
                <span className="text-muted-foreground">{t("tracking")}: </span>
                <span className="font-mono">{shipment.trackingNumber}</span>
              </p>
            )}
            {delivered && (
              <p className="text-muted-foreground">
                {t("deliveredOn", {
                  date: new Date(shipment.deliveredAt!).toLocaleDateString(dl, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }),
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              {!delivered && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isDelivering}
                  onClick={confirmDelivered}
                >
                  {isDelivering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PackageCheck className="h-3.5 w-3.5" />
                  )}
                  {t("markDelivered")}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                {t("updateTracking")}
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">{t("description")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("carrier")}</Label>
                <Input
                  list="shipment-carriers"
                  autoComplete="off"
                  className="h-8 text-sm"
                  placeholder={t("carrierPlaceholder")}
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
                <datalist id="shipment-carriers">
                  {COMMON_CARRIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("tracking")}</Label>
                <Input
                  autoComplete="off"
                  className="h-8 text-sm"
                  placeholder={t("trackingPlaceholder")}
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" disabled={isPending} onClick={submit}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                {shipment ? t("saveTracking") : t("markShipped")}
              </Button>
              {editing && (
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

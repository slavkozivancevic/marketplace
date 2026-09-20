"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFormState } from "react-hook-form";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Truck, CheckCircle2, Pencil, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { useWhenSettled } from "@/lib/hooks/useWhenSettled";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { markShipped, markDelivered } from "@/features/shipments/actions/shipments";
import { useRefreshOrderViews } from "@/features/orders/hooks/useRefreshOrderViews";

// This seller's part of the order. It exists from the moment the order does - the
// page redirects if it somehow does not - so "not shipped yet" is
// `shippedAt === null`, never a missing row.
type Shipment = {
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

type TrackingForm = { carrier: string; tracking: string };

const COMMON_CARRIERS = ["DHL", "UPS", "FedEx", "GLS", "PostNL", "Post Express", "BEX", "DExpress"];

/**
 * Two jobs that look alike and are not.
 *
 * Before the parcel goes out this is an ACTION: "mark it shipped", perfectly
 * valid with both boxes empty, so it keeps a plain button. Once it has shipped,
 * those same two boxes become an ordinary edit against a saved baseline, and it
 * uses what every other form in the admin uses - a dirty check, per-field
 * reminders of the saved value, Discard, and a Save that is simply not offered
 * while nothing has changed. An unchanged save is not merely useless here: it
 * would have to decide whether to email the buyer about a change that never
 * happened.
 */
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
  // Both toasts wait for the refresh inside their transition to be applied: the
  // badge at the top of this card IS the result being announced.
  const announceSaved = useAnnounceWhenSettled(isPending);
  const announceDelivered = useAnnounceWhenSettled(isDelivering);
  const closeWhenSettled = useWhenSettled(isPending);
  const [editing, setEditing] = useState(false);

  const savedCarrier = shipment.carrier ?? "";
  const savedTracking = shipment.trackingNumber ?? "";

  const { register, handleSubmit, reset, control } = useForm<TrackingForm>({
    mode: "onChange",
    defaultValues: { carrier: savedCarrier, tracking: savedTracking },
  });

  // Read through `useFormState`, not by destructuring `formState` off `useForm`:
  // that is a proxy getter whose object identity never changes, so the React
  // Compiler caches the first read and leaves isDirty frozen. Same fix as
  // OrgShippingForm.
  const { isDirty, dirtyFields } = useFormState({ control });
  useUnsavedChangesWarning(isDirty);

  // Drop a half-typed draft when the route changes. The client Router Cache
  // (dynamicOnHover) keeps this component's state alive across instant back-nav,
  // so without this an unsaved carrier/tracking would linger when you return.
  // Keyed on the navigation counter rather than the pathname: coming back to the
  // same order leaves `usePathname` unchanged, which is exactly the case this
  // guards against. It also stays put across a router.refresh(), so a save in
  // progress is never reset out from under itself.
  const navGeneration = useNavigationGeneration();
  useEffect(() => {
    reset({ carrier: savedCarrier, tracking: savedTracking });
    setEditing(false);
    // Intentionally keyed on the navigation counter only - sync back to the
    // server values whenever we navigate to/away from this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const delivered = shipment.deliveredAt != null;
  const shippedAt = shipment.shippedAt;
  const showForm = !shippedAt || editing;

  const onSubmit = (data: TrackingForm) => {
    start(async () => {
      const res = await markShipped(
        orderId,
        data.tracking.trim() || undefined,
        data.carrier.trim() || undefined,
      );
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      announceSaved({ message: shippedAt ? t("trackingUpdated") : t("markedShipped") });
      // Both of these belong to the RESULT, not to the request, so both wait for
      // the frame where the result is on screen.
      //
      // Closing early would swap the form - spinner and all - for a summary still
      // holding the old carrier and number, which then changed a moment later
      // when the refresh landed. Re-baselining early is subtler: it clears the
      // dirty flags, the "saved value" hints under the fields vanish, the content
      // above the save bar shrinks and the bar jumps out from under the cursor
      // while its own spinner is still running. Nothing about this form moves
      // until the save has something to show.
      closeWhenSettled(() => {
        reset(data);
        setEditing(false);
      });
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
      announceDelivered({ message: t("markedDelivered") });
      refreshOrderViews();
    });
  };

  /** Reverts to the saved values and leaves the editor - what Cancel always did. */
  const discardAndClose = () => {
    reset({ carrier: savedCarrier, tracking: savedTracking });
    setEditing(false);
  };

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
        ) : shippedAt ? (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("shipped")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("unfulfilled")}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {shippedAt && !editing && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">
              {t("shippedOn", {
                date: new Date(shippedAt).toLocaleDateString(dl, {
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
                  variant="successSolid"
                  size="sm"
                  className="gap-1.5"
                  disabled={isDelivering}
                  onClick={confirmDelivered}
                >
                  {isDelivering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PackageCheck className="h-3.5 w-3.5" />
                  )}
                  {isDelivering ? t("markingDelivered") : t("markDelivered")}
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
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <p className="text-muted-foreground text-xs">{t("description")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("carrier")}</Label>
                <Input
                  list="shipment-carriers"
                  autoComplete="off"
                  maxLength={60}
                  className="h-8 text-sm"
                  placeholder={t("carrierPlaceholder")}
                  {...register("carrier")}
                />
                <datalist id="shipment-carriers">
                  {COMMON_CARRIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {/* A field that was empty has no saved value to show, so the
                    shared hint falls back to a plain "edited" marker rather than
                    printing "Saved: " with nothing after it. */}
                <ChangedHint
                  changed={!!dirtyFields.carrier}
                  savedText={savedCarrier || null}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("tracking")}</Label>
                <Input
                  autoComplete="off"
                  maxLength={60}
                  className="h-8 text-sm"
                  placeholder={t("trackingPlaceholder")}
                  {...register("tracking")}
                />
                <ChangedHint
                  changed={!!dirtyFields.tracking}
                  savedText={savedTracking || null}
                />
              </div>
            </div>

            {shippedAt ? (
              // Editing a shipment that already went out: an ordinary save against
              // a baseline, so the shared bar owns it. An unchanged save is not
              // offered at all - there is nothing to write, and nothing to tell
              // the buyer.
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* `flex-1` matters: the bar lays itself out with the status on
                    the left and its actions pushed right, which it can only do
                    if it is given the width to do it in. As a bare flex item it
                    shrinks to its contents and the buttons end up against the
                    label. */}
                <FormSaveBar
                  className="flex-1"
                  sticky={false}
                  isDirty={isDirty}
                  isPending={isPending}
                  onDiscard={discardAndClose}
                  saveLabel={t("saveTracking")}
                />
                {/* Only reachable while the bar is collapsed, so there is nothing
                    to discard - this just leaves the editor. `type="button"` is
                    not optional: Button sets no type, so inside a form the
                    browser makes it a submit and closing would save. */}
                {!isDirty && !isPending && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={discardAndClose}
                  >
                    {t("cancel")}
                  </Button>
                )}
              </div>
            ) : (
              // First ship. Both boxes are optional, so "nothing typed" is a
              // perfectly good save, and a dirty check would block the only action
              // this card exists for.
              <Button type="submit" size="sm" className="gap-1.5" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Truck className="h-3.5 w-3.5" />
                )}
                {isPending ? t("markingShipped") : t("markShipped")}
              </Button>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

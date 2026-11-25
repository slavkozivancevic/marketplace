"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, getPathname } from "@/i18n/navigation";
import { BreadcrumbNav } from "@/components/seo/BreadcrumbNav";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonCopy, SkeletonPageHeader } from "@/components/ui/skeleton";
import { Info } from "lucide-react";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { shippingCountryLabel } from "@/lib/i18n/countries";
import { readRouteShape } from "@/lib/navigation/routeShape";
import { PLATFORM_FEE_PERCENT } from "@/features/payments/config";
import { orderStatusKey } from "../statusBadge";
import { orgOrderShapeKey, type OrgOrderDetailShape } from "../orgOrderDetailShape";
import { BadgeSlot, ButtonSlot, CardTitleCopy, CopyNote, CopyRow } from "./OrderSkeletonParts";

/**
 * The received-order detail page while it loads, drawn from what the list row
 * handed over (`OrgOrderDetailShape`): the same cards, in the same order, with
 * the same markup, so nothing moves when the page lands. Known copy - card
 * titles, labels, the buyer's address, figures the row already had - is drawn
 * as `SkeletonCopy`, which wraps exactly where the real text will on any width;
 * what the row cannot know (the buyer's email, line titles) is a bar of the
 * line's own height.
 *
 * A hard load or a typed URL has no hand-off and draws `DEFAULT_SHAPE` - a COD
 * order waiting on the seller, the state a seller most often opens to act on.
 */
export function OrgOrderDetailSkeleton() {
  const params = useParams<{ id?: string }>();
  const id = params.id ?? "";
  const handed = id ? readRouteShape<OrgOrderDetailShape>(orgOrderShapeKey(id)) : null;
  const shape = handed ?? DEFAULT_SHAPE;
  const t = useTranslations("orgOrders");
  const tCrumbs = useTranslations("breadcrumbs");
  const locale = useLocale();
  const dl = dateLocale(locale);
  const shortId = `#${id.slice(-8).toUpperCase()}`;
  const money = (amount: number) => formatPrice(amount, shape.currency as Currency, locale);
  // A hand-off only ever exists in the browser (it is set in a click handler),
  // so its dates are formatted client-side in the viewer's zone, as the page
  // does. Without one this renders on the server too and must hydrate
  // identically - the placeholder dates are fixed and formatted in UTC.
  const timeZone = handed ? undefined : "UTC";
  const back = (
    <Button asChild variant="outline" size="sm">
      <Link href="/dashboard/organization/orders">{t("backToOrders")}</Link>
    </Button>
  );

  const crumbs = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("receivedOrders"), href: getPathname({ href: "/dashboard/organization/orders", locale }) },
    {
      name: `${tCrumbs("orderDetails")} ${shortId}`,
      href: getPathname({ href: { pathname: "/dashboard/organization/orders/[id]", params: { id } }, locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <BreadcrumbNav items={crumbs} />
        {handed ? (
          <PageHeader
            title={`${t("orderDetail")} ${shortId}`}
            description={t("placedOn", {
              date: new Date(handed.createdAt).toLocaleDateString(dl, {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            })}
          >
            {back}
          </PageHeader>
        ) : (
          <SkeletonPageHeader title={`${t("orderDetail")} ${shortId}`} descriptionWidth="w-48" actions={back} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="max-w-2xl space-y-5">
          {!shape.canManage && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t("readOnly")}</AlertTitle>
              <AlertDescription>{t("viewOnly")}</AlertDescription>
            </Alert>
          )}

          <SummaryCard shape={shape} shortId={shortId} timeZone={timeZone} />
          {(shape.action.paymentReceived || shape.action.cancel) && <ActionCard shape={shape} />}
          {shape.shipment && <ShipmentCard shipment={shape.shipment} />}
          {shape.returnsCount > 0 && <ReturnsCard count={shape.returnsCount} />}
          {shape.ledger.length > 0 && <LedgerCard shape={shape} money={money} />}
          <ItemsCard shape={shape} money={money} />
          <BuyerCard shape={shape} />
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function SummaryCard({
  shape,
  shortId,
  timeZone,
}: {
  shape: OrgOrderDetailShape;
  shortId: string;
  timeZone: string | undefined;
}) {
  const t = useTranslations("orgOrders");
  const locale = useLocale();
  const dl = dateLocale(locale);
  const dateTime = new Date(shape.createdAt).toLocaleString(dl, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitleCopy>{t("orderSummary")}</CardTitleCopy>
        <div className="flex items-center gap-2">
          <BadgeSlot icon className="gap-1 text-xs" label={shape.isCod ? t("cashOnDelivery") : t("card")} />
          {shape.hasActiveReturn && <BadgeSlot icon className="gap-1 text-xs" label={t("returnInProgress")} />}
          {shape.refundPartial && <BadgeSlot className="gap-1 text-xs" label={t("partiallyRefunded")} />}
          <BadgeSlot label={t(orderStatusKey(shape.stage))} />
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-1.5">
        <CopyRow className="text-muted-foreground" label={t("orderId")} value={<span className="font-mono">{shortId}</span>} />
        <CopyRow className="text-muted-foreground" label={t("date")} value={dateTime} />
        {shape.couponCode != null && (
          <div className="flex justify-between text-muted-foreground">
            <span>
              <SkeletonCopy>{t("coupon")}</SkeletonCopy>
            </span>
            <BadgeSlot className="font-mono text-[10px]" label={shape.couponCode} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionCard({ shape }: { shape: OrgOrderDetailShape }) {
  const t = useTranslations("orgOrders");
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <CardHeader className="pb-2">
        <CardTitleCopy>{t("actionRequired")}</CardTitleCopy>
      </CardHeader>
      <CardContent className="space-y-3">
        {shape.action.paymentReceived && (
          <p className="text-sm">
            <SkeletonCopy>{t("codPaymentDescription")}</SkeletonCopy>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {shape.action.paymentReceived && <ButtonSlot label={t("markPaymentReceived")} iconClass="mr-2 size-3.5" />}
          {shape.action.cancel && <ButtonSlot label={t("cancelOrder")} iconClass="mr-2 size-3.5" />}
        </div>
      </CardContent>
    </Card>
  );
}

function ShipmentCard({ shipment }: { shipment: NonNullable<OrgOrderDetailShape["shipment"]> }) {
  const t = useTranslations("shipments");
  const locale = useLocale();
  const dl = dateLocale(locale);
  const short = (iso: string) =>
    new Date(iso).toLocaleDateString(dl, { year: "numeric", month: "short", day: "numeric" });
  const delivered = shipment.deliveredAt != null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitleCopy icon>{t("title")}</CardTitleCopy>
        {delivered ? (
          <BadgeSlot icon className="gap-1" label={t("delivered")} />
        ) : shipment.shippedAt ? (
          <BadgeSlot icon className="gap-1" label={t("shipped")} />
        ) : (
          <BadgeSlot label={t("unfulfilled")} />
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {shipment.shippedAt ? (
          <div className="space-y-1.5">
            <p>
              <SkeletonCopy>{t("shippedOn", { date: short(shipment.shippedAt) })}</SkeletonCopy>
            </p>
            {shipment.carrier && (
              <p>
                <SkeletonCopy>
                  {t("carrier")}: {shipment.carrier}
                </SkeletonCopy>
              </p>
            )}
            {shipment.trackingNumber && (
              <p>
                <SkeletonCopy>
                  {t("tracking")}: <span className="font-mono">{shipment.trackingNumber}</span>
                </SkeletonCopy>
              </p>
            )}
            {delivered && (
              <p>
                <SkeletonCopy>{t("deliveredOn", { date: short(shipment.deliveredAt!) })}</SkeletonCopy>
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              {!delivered && <ButtonSlot className="gap-1.5" label={t("markDelivered")} iconClass="size-3.5" />}
              <ButtonSlot className="gap-1.5" label={t("updateTracking")} iconClass="size-3.5" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs">
              <SkeletonCopy>{t("description")}</SkeletonCopy>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[t("carrier"), t("tracking")].map((label) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <Label className="text-xs">
                    <SkeletonCopy>{label}</SkeletonCopy>
                  </Label>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
            <ButtonSlot className="gap-1.5" label={t("markShipped")} iconClass="size-3.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Drawn from the count only - the list does not know a return's lines. */
function ReturnsCard({ count }: { count: number }) {
  const t = useTranslations("returns");
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitleCopy icon>{t("sellerTitle")}</CardTitleCopy>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        {Array.from({ length: count }, (_, i) => (
          <div key={i}>
            {i > 0 && <Separator className="my-3" />}
            <div className="flex flex-col gap-1">
              <BadgeSlot className="w-fit text-[10px]" label={t("statusRequested")} />
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LedgerCard({ shape, money }: { shape: OrgOrderDetailShape; money: (n: number) => string }) {
  const t = useTranslations("orgOrders");
  const locale = useLocale();
  const dl = dateLocale(locale);
  const typeLabel: Record<string, string> = {
    CHARGE: t("txType.charge"),
    REFUND: t("txType.refund"),
    PAYOUT: t("txType.payout"),
    FEE: t("txType.fee"),
  };
  const statusLabel: Record<string, string> = {
    PENDING: t("txStatus.pending"),
    SUCCEEDED: t("txStatus.succeeded"),
    FAILED: t("txStatus.failed"),
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitleCopy icon>{t("paymentHistory")}</CardTitleCopy>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        {shape.ledger.map((tx, index) => {
          const payoutOrFee = tx.type === "PAYOUT" || tx.type === "FEE";
          return (
            <div key={index}>
              {index > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <BadgeSlot
                      className="text-[10px]"
                      label={tx.type === "FEE" && tx.amount < 0 ? t("txType.feeCredit") : (typeLabel[tx.type] ?? tx.type)}
                    />
                    <span className="text-xs inline-flex items-center gap-1">
                      <Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
                      <SkeletonCopy>{tx.provider === "COD" ? t("cashOnDelivery") : t("card")}</SkeletonCopy>
                    </span>
                    {payoutOrFee && tx.refundState === "full" && (
                      <BadgeSlot className="text-[10px]" label={tx.type === "FEE" ? t("feeVoided") : t("refunded")} />
                    )}
                    {payoutOrFee && tx.refundState === "partial" && (
                      <BadgeSlot
                        className="text-[10px]"
                        label={tx.type === "FEE" ? t("feePartlyVoided") : t("partiallyRefunded")}
                      />
                    )}
                  </div>
                  <span className="text-xs">
                    <SkeletonCopy>
                      {new Date(tx.createdAt).toLocaleString(dl, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </SkeletonCopy>
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-semibold tabular-nums">
                    <SkeletonCopy>
                      {tx.type === "FEE" && tx.amount < 0 ? "+" : tx.type === "REFUND" || tx.type === "FEE" ? "-" : ""}
                      {money(Math.abs(tx.amount))}
                    </SkeletonCopy>
                  </span>
                  {tx.type === "PAYOUT" && tx.refundState === "partial" && (
                    <span className="text-[11px] tabular-nums">
                      <SkeletonCopy>-{money(tx.reversedNet)}</SkeletonCopy>
                    </span>
                  )}
                  {tx.type === "FEE" && tx.refundState === "partial" && (
                    <span className="text-[11px] tabular-nums">
                      <SkeletonCopy>
                        {tx.amount < 0 ? "-" : "+"}
                        {money(Math.abs(tx.reversedNet))}
                      </SkeletonCopy>
                    </span>
                  )}
                  <BadgeSlot className="text-[10px]" label={statusLabel[tx.status] ?? tx.status} />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ItemsCard({ shape, money }: { shape: OrgOrderDetailShape; money: (n: number) => string }) {
  const t = useTranslations("orgOrders");
  const m = shape.money;
  const { isCod, isCancelled, part } = shape;
  const quiet = m.payoutReversed > 0 || m.codNetted !== 0 || isCancelled;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitleCopy>{t("yourItems")}</CardTitleCopy>
      </CardHeader>
      <CardContent className="space-y-0">
        {shape.items.map((item, index) => (
          <div key={index}>
            {index > 0 && <Separator className="my-3" />}
            <div className="flex gap-4 items-center">
              <Skeleton className="h-14 w-14 shrink-0 rounded border" />
              <div className="flex-1 min-w-0">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
                {item.subline && (
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                )}
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex h-5 items-center shrink-0">
                <Skeleton className="h-3.5 w-14" />
              </div>
            </div>
          </div>
        ))}

        <Separator className="my-4" />

        {isCod && !isCancelled && (
          <div className="mb-4 rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <CopyRow label={t("codGoods")} value={money(part.itemsSubtotal)} />
            {part.discountShare > 0 && (
              <CopyRow
                label={t("couponPlatformFunded", { code: shape.couponCode ?? "" })}
                value={`-${money(part.discountShare)}`}
              />
            )}
            {part.shippingAmount > 0 && (
              <CopyRow label={t("shippingCollected")} value={`+${money(part.shippingAmount)}`} />
            )}
            <CopyRow className="font-semibold" label={t("codToCollect")} value={money(m.codCashToCollect)} />
            {part.discountShare > 0 && !part.codSettled && (
              <p className="pt-1 text-xs">
                <SkeletonCopy>{t("codToCollectNote")}</SkeletonCopy>
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5 text-sm">
          <CopyRow label={t("yourSubtotal")} value={money(shape.orgSubtotal)} />
          <CopyRow label={t("platformFee", { percent: PLATFORM_FEE_PERCENT })} value={`-${money(m.platformFee)}`} />
          {shape.orgShipping > 0 && <CopyRow label={t("shippingCollected")} value={`+${money(shape.orgShipping)}`} />}
          <CopyRow
            className={quiet ? undefined : "font-semibold"}
            label={isCod ? t("codEarnings") : t("yourPayout")}
            value={money(m.orgPayout)}
          />
          {isCod && !isCancelled && m.codOwedAfterRefunds !== 0 && (
            <CopyRow
              label={m.codOwedAfterRefunds > 0 ? t("codOwedToPlatform") : t("codOwedToYou")}
              value={money(Math.abs(m.codOwedAfterRefunds))}
            />
          )}
          {m.codNetted > 0 && <CopyRow label={t("codBalanceNettedLabel")} value={`-${money(m.codNetted)}`} />}
          {m.codNetted < 0 && <CopyRow label={t("codBalanceCreditLabel")} value={`+${money(-m.codNetted)}`} />}
          {m.payoutReversedFromTransfer > 0 && (
            <CopyRow
              label={isCod ? t("codReversedLabel") : t("payoutReversed")}
              value={`-${money(m.payoutReversedFromTransfer)}`}
            />
          )}
          {(m.payoutReversedFromTransfer > 0 || m.codNetted !== 0) && (
            <CopyRow
              className="font-semibold"
              label={
                isCod
                  ? t("codAfterRefundsLabel")
                  : m.payoutReversedFromTransfer > 0
                    ? t("payoutAfterRefunds")
                    : t("payoutTransferred")
              }
              value={money(m.finalTransferred)}
            />
          )}
          {isCancelled && <CopyRow className="font-semibold" label={t("payoutAfterCancellation")} value={money(0)} />}
        </div>
        {isCancelled && <CopyNote>{t("cancelledNoPayoutNote")}</CopyNote>}
        {m.externalRefundPending > 0 && (
          <CopyNote>{t("externalRefundNotDeductedNote", { amount: money(m.externalRefundPending) })}</CopyNote>
        )}
        {isCod && !isCancelled && m.codOwedAfterRefunds !== 0 && <CopyNote>{t("codBalancePooledNote")}</CopyNote>}
        {isCod && !isCancelled && m.codCommissionCredited !== 0 && (
          <CopyNote>
            {t(m.codCommissionCredited > 0 ? "codCommissionCreditedNote" : "codCreditReducedNote", {
              amount: money(Math.abs(m.codCommissionCredited)),
              remaining: money(Math.abs(m.codOwedAfterRefunds)),
            })}
          </CopyNote>
        )}
        {m.codNetted > 0 && m.codDebtRestored === 0 && <CopyNote>{t("codBalanceNettedNote")}</CopyNote>}
        {m.codNetted < 0 && <CopyNote>{t("codBalanceCreditNote")}</CopyNote>}
        {m.codDebtRestored > 0 && <CopyNote>{t("codDebtRestoredNote", { amount: money(m.codDebtRestored) })}</CopyNote>}
        {shape.discountAmount > 0 && !isCancelled && (
          <CopyNote>
            {t("couponSellerNote", {
              code: shape.couponCode ?? "",
              percent: PLATFORM_FEE_PERCENT,
              amount: money(part.discountShare),
            })}
          </CopyNote>
        )}
      </CardContent>
    </Card>
  );
}

function BuyerCard({ shape }: { shape: OrgOrderDetailShape }) {
  const t = useTranslations("orgOrders");
  const locale = useLocale();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitleCopy icon>{t("buyerAndShipping")}</CardTitleCopy>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          {shape.user.name && (
            <p className="font-medium">
              <SkeletonCopy>{shape.user.name}</SkeletonCopy>
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm" />
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-48" />
            </div>
          </div>
        </div>
        {shape.shippingLine1 ? (
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide">
              <SkeletonCopy>{t("deliveryAddress")}</SkeletonCopy>
            </p>
            {shape.shippingName && (
              <p className="font-medium">
                <SkeletonCopy>{shape.shippingName}</SkeletonCopy>
              </p>
            )}
            <p>
              <SkeletonCopy>{shape.shippingLine1}</SkeletonCopy>
            </p>
            {shape.shippingLine2 && (
              <p>
                <SkeletonCopy>{shape.shippingLine2}</SkeletonCopy>
              </p>
            )}
            <p>
              <SkeletonCopy>
                {[shape.shippingCity, shape.shippingState, shape.shippingPostalCode].filter(Boolean).join(", ")}
              </SkeletonCopy>
            </p>
            {shape.shippingCountry && (
              <p>
                <SkeletonCopy>{shippingCountryLabel(shape.shippingCountry, locale)}</SkeletonCopy>
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs">
            <SkeletonCopy>{t("noShippingAddress")}</SkeletonCopy>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** No hand-off (hard load, typed URL): a fresh COD order waiting on the seller. */
const DEFAULT_SHAPE: OrgOrderDetailShape = {
  // Drawn transparent; fixed so the server and the client format the same text.
  createdAt: "2026-11-25T12:34:00.000Z",
  paymentMethod: "COD",
  currency: "usd",
  stage: "PENDING",
  refundPartial: false,
  hasActiveReturn: false,
  couponCode: null,
  canManage: true,
  action: { paymentReceived: false, cancel: true },
  shipment: { shippedAt: null, deliveredAt: null, carrier: null, trackingNumber: null },
  returnsCount: 0,
  ledger: [],
  items: [{ subline: false }],
  isCod: true,
  isCancelled: false,
  discountAmount: 0,
  orgSubtotal: 4020,
  orgShipping: 301,
  part: { itemsSubtotal: 4020, discountShare: 0, shippingAmount: 301, codSettled: false },
  money: {
    externalRefundPending: 0,
    orgPayout: 3919,
    codCashToCollect: 4321,
    codCommissionCredited: 0,
    codOwedAfterRefunds: 0,
    payoutReversed: 0,
    codNetted: 0,
    payoutReversedFromTransfer: 0,
    codDebtRestored: 0,
    finalTransferred: 0,
    platformFee: 402,
  },
  user: { name: "Test Buyer" },
  shippingName: "Test Buyer",
  shippingLine1: "Ulica Primera 12",
  shippingLine2: null,
  shippingCity: "Demograd",
  shippingState: null,
  shippingPostalCode: "00000",
  shippingCountry: "RS",
};

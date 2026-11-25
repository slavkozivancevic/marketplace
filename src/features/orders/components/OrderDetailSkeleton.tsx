"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Link, getPathname } from "@/i18n/navigation";
import { BreadcrumbNav } from "@/components/seo/BreadcrumbNav";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonCopy, SkeletonPageHeader } from "@/components/ui/skeleton";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { shippingCountryLabel } from "@/lib/i18n/countries";
import { readRouteShape } from "@/lib/navigation/routeShape";
import { orderStatusKey } from "../statusBadge";
import { orderShapeKey, type OrderDetailShape } from "../orderDetailShape";
import { BadgeSlot, ButtonSlot, CardTitleCopy, CopyNote, CopyRow } from "./OrderSkeletonParts";

/**
 * The buyer's order detail page while it loads, drawn from what the list row
 * handed over (`OrderDetailShape`) - see `OrgOrderDetailSkeleton` for the
 * approach. Line titles are carried as text here because this page lets them
 * wrap (the seller page truncates), and how far they wrap decides every card
 * below.
 *
 * A hard load or a typed URL has no hand-off and draws `DEFAULT_SHAPE`: one
 * seller, a cash-on-delivery order that has not shipped yet.
 */
export function OrderDetailSkeleton() {
  const params = useParams<{ id?: string }>();
  const id = params.id ?? "";
  const handed = id ? readRouteShape<OrderDetailShape>(orderShapeKey(id)) : null;
  const shape = handed ?? DEFAULT_SHAPE;
  const t = useTranslations();
  const tCrumbs = useTranslations("breadcrumbs");
  const locale = useLocale();
  const dl = dateLocale(locale);
  const shortId = `#${id.slice(-8).toUpperCase()}`;
  const money = (amount: number) => formatPrice(amount, shape.currency as Currency, locale);
  // Same rule as the seller skeleton: a hand-off is browser-only and formats
  // in the viewer's zone; without one this also renders on the server, so the
  // placeholder date is fixed and formatted in UTC.
  const timeZone = handed ? undefined : "UTC";

  const crumbs = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myOrders"), href: getPathname({ href: "/dashboard/orders", locale }) },
    {
      name: `${tCrumbs("orderDetails")} ${shortId}`,
      href: getPathname({ href: { pathname: "/dashboard/orders/[id]", params: { id } }, locale }),
    },
  ];
  const actions = (
    <>
      {shape.invoiceable && (
        <Button asChild variant="outline">
          <a href={`/${locale}/dashboard/orders/${id}/invoice`} target="_blank" rel="noopener noreferrer">
            <FileText className="mr-2 h-4 w-4" />
            {t("invoice.download")}
          </a>
        </Button>
      )}
      <Button asChild variant="outline">
        <Link href="/dashboard/orders">{t("orders.backToOrders")}</Link>
      </Button>
    </>
  );
  const short = (iso: string) =>
    new Date(iso).toLocaleDateString(dl, { timeZone, year: "numeric", month: "short", day: "numeric" });
  const discounted = shape.discountAmount > 0 || shape.shippingTotal > 0;
  const quietTotal = shape.buyerRefunded > 0 || shape.isCancelled;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <BreadcrumbNav items={crumbs} />
        {handed ? (
          <PageHeader
            title={`${t("orders.details")} ${shortId}`}
            description={t("orders.placedOn", {
              date: new Date(handed.createdAt).toLocaleDateString(dl, {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            })}
          >
            {actions}
          </PageHeader>
        ) : (
          <SkeletonPageHeader title={`${t("orders.details")} ${shortId}`} descriptionWidth="w-48" actions={actions} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="max-w-2xl space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitleCopy plain>{t("orders.summary")}</CardTitleCopy>
              <div className="flex items-center gap-2">
                <BadgeSlot icon className="gap-1 text-xs" label={shape.isCod ? t("orders.cashOnDelivery") : t("orders.card")} />
                {shape.hasActiveReturn && <BadgeSlot icon className="gap-1 text-xs" label={t("orders.returnInProgress")} />}
                {shape.partiallyRefunded && <BadgeSlot className="gap-1 text-xs" label={t("orders.partiallyRefunded")} />}
                <BadgeSlot label={t(`orders.${orderStatusKey(shape.stage)}` as Parameters<typeof t>[0])} />
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <CopyRow numeric={false} className="text-muted-foreground" label={t("orders.orderId")} value={<span className="font-mono">{shortId}</span>} />
              <CopyRow
                numeric={false}
                className="text-muted-foreground"
                label={t("orders.date")}
                value={new Date(shape.createdAt).toLocaleString(dl, {
                  timeZone,
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </CardContent>
          </Card>

          {/* Shipping, one row per seller */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitleCopy icon>{t("shipments.title")}</CardTitleCopy>
            </CardHeader>
            <CardContent className="space-y-0 text-sm">
              {shape.sellers.map((seller, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      <SkeletonCopy>{seller.name}</SkeletonCopy>
                    </span>
                    <BadgeSlot
                      className="text-[10px]"
                      label={
                        seller.cancelledAt
                          ? t("shipments.cancelled")
                          : seller.deliveredAt
                            ? t("shipments.delivered")
                            : seller.shippedAt
                              ? t("shipments.shipped")
                              : t("shipments.notShipped")
                      }
                    />
                  </div>
                  {seller.cancelledAt && (
                    <div className="mt-1 text-xs space-y-0.5">
                      <p>
                        <SkeletonCopy>{t("shipments.cancelledOn", { date: short(seller.cancelledAt) })}</SkeletonCopy>
                      </p>
                    </div>
                  )}
                  {!seller.cancelledAt && seller.shippedAt && (
                    <div className="mt-1 text-xs space-y-0.5">
                      <p>
                        <SkeletonCopy>{t("shipments.shippedOn", { date: short(seller.shippedAt) })}</SkeletonCopy>
                      </p>
                      {seller.deliveredAt && (
                        <p>
                          <SkeletonCopy>{t("shipments.deliveredOn", { date: short(seller.deliveredAt) })}</SkeletonCopy>
                        </p>
                      )}
                      {seller.carrier && (
                        <p>
                          <SkeletonCopy>
                            {t("shipments.carrier")}: {seller.carrier}
                          </SkeletonCopy>
                        </p>
                      )}
                      {seller.trackingNumber && (
                        <p>
                          <SkeletonCopy>
                            {t("shipments.tracking")}: <span className="font-mono">{seller.trackingNumber}</span>
                          </SkeletonCopy>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {shape.returnSellers && <ReturnsCard sellers={shape.returnSellers} />}

          {/* Items + totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitleCopy plain>{t("orders.yourItems")}</CardTitleCopy>
            </CardHeader>
            <CardContent className="space-y-0">
              {shape.items.map((item, index) => (
                <div key={index}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex gap-4 items-center">
                    <Skeleton className="h-14 w-14 shrink-0 rounded border" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        <SkeletonCopy>{item.title}</SkeletonCopy>
                        {item.cancelled && (
                          <BadgeSlot className="ml-2 text-[10px] align-middle" label={t("shipments.cancelled")} />
                        )}
                      </p>
                      {item.variantLabel && (
                        <p className="text-xs">
                          <SkeletonCopy>{item.variantLabel}</SkeletonCopy>
                        </p>
                      )}
                      <p className="text-xs">
                        <SkeletonCopy>
                          {money(item.price)} × {item.quantity}
                        </SkeletonCopy>
                      </p>
                    </div>
                    <p className="font-semibold text-sm">
                      <SkeletonCopy>{money(item.price * item.quantity)}</SkeletonCopy>
                    </p>
                  </div>
                </div>
              ))}

              <Separator className="my-4" />
              <div className="space-y-1.5">
                {discounted && (
                  <>
                    <CopyRow
                      numeric={false}
                      className="text-sm"
                      label={t("orders.subtotal")}
                      value={money(shape.total + shape.discountAmount - shape.shippingTotal)}
                    />
                    {shape.discountAmount > 0 && (
                      <CopyRow
                        numeric={false}
                        className="text-sm"
                        label={`${t("orders.discount")}${shape.couponCode ? ` (${shape.couponCode})` : ""}`}
                        value={`-${money(shape.discountAmount)}`}
                      />
                    )}
                    {shape.shippingTotal > 0 && (
                      <CopyRow numeric={false} className="text-sm" label={t("orders.shipping")} value={money(shape.shippingTotal)} />
                    )}
                  </>
                )}
                <CopyRow
                  numeric={false}
                  className={quietTotal ? "text-sm" : "font-semibold"}
                  label={t("orders.yourTotal")}
                  value={money(shape.total)}
                />
                {shape.isCancelled && (
                  <CopyRow numeric={false} className="font-semibold" label={t("orders.charged")} value={money(0)} />
                )}
                {shape.buyerRefunded > 0 && (
                  <>
                    <CopyRow numeric={false} className="text-sm" label={t("orders.refunded")} value={`-${money(shape.buyerRefunded)}`} />
                    <CopyRow
                      numeric={false}
                      className="font-semibold"
                      label={t("orders.paidAfterRefunds")}
                      value={money(shape.total - shape.buyerRefunded)}
                    />
                  </>
                )}
              </div>
              {shape.isCancelled && <CopyNote>{t("orders.cancelledNothingChargedNote")}</CopyNote>}
            </CardContent>
          </Card>

          {shape.shippingLine1 && (
            <Card>
              <CardHeader>
                <CardTitleCopy icon>{t("orders.shippingAddress")}</CardTitleCopy>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** `BuyerReturns` at rest (no request form open). */
function ReturnsCard({ sellers }: { sellers: NonNullable<OrderDetailShape["returnSellers"]> }) {
  const t = useTranslations("returns");
  const statusLabel: Record<string, string> = {
    REQUESTED: t("statusRequested"),
    APPROVED: t("statusApproved"),
    REJECTED: t("statusRejected"),
    SHIPPED: t("statusShipped"),
    REFUNDED: t("statusRefunded"),
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitleCopy icon>{t("title")}</CardTitleCopy>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        {sellers.map((seller, index) => (
          <div key={index}>
            {index > 0 && <Separator className="my-3" />}
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">
                <SkeletonCopy>{seller.name}</SkeletonCopy>
              </span>
              {seller.button && <ButtonSlot label={t("requestReturn")} />}
            </div>
            {seller.hint && (
              <p className="mt-1 text-xs">
                <SkeletonCopy>{t(seller.hint)}</SkeletonCopy>
              </p>
            )}
            {seller.daysLeft != null && (
              <p className="mt-1 text-xs">
                <SkeletonCopy>{t("daysLeftToReturn", { count: seller.daysLeft })}</SkeletonCopy>
              </p>
            )}
            {seller.returns.map((ret, i) => (
              <div key={i} className="mt-2 rounded-md border bg-muted/30 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <BadgeSlot className="text-[10px]" label={statusLabel[ret.status] ?? ret.status} />
                  {ret.status === "APPROVED" && (
                    <ButtonSlot className="gap-1.5 h-7" label={t("markShipped")} iconClass="size-3.5" />
                  )}
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {ret.lines.map((line, j) => {
                    const qty = ` × ${line.quantity}`;
                    return (
                      <li key={j}>
                        <div>
                          <span className="block truncate">
                            <SkeletonCopy>
                              {line.title}
                              {line.variantLabel ? "" : qty}
                            </SkeletonCopy>
                          </span>
                          {line.variantLabel && (
                            <span className="block truncate">
                              <SkeletonCopy>
                                {line.variantLabel}
                                {qty}
                              </SkeletonCopy>
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {ret.reason && (
                  <p className="mt-1 text-xs">
                    <SkeletonCopy>
                      {t("reasonLabel")}: {ret.reason}
                    </SkeletonCopy>
                  </p>
                )}
                {ret.resolutionNote && (
                  <p className="mt-1 text-xs">
                    <SkeletonCopy>{ret.resolutionNote}</SkeletonCopy>
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** No hand-off (hard load, typed URL): one seller, COD, not shipped yet. */
const DEFAULT_SHAPE: OrderDetailShape = {
  // Drawn transparent; fixed so the server and the client format the same text.
  createdAt: "2026-11-25T12:34:00.000Z",
  isCod: true,
  currency: "usd",
  stage: "PENDING",
  partiallyRefunded: false,
  hasActiveReturn: false,
  invoiceable: false,
  sellers: [{ name: "MarketVerse", shippedAt: null, deliveredAt: null, cancelledAt: null, carrier: null, trackingNumber: null }],
  returnSellers: null,
  items: [{ title: "Thermos Bottle 750ml", variantLabel: null, cancelled: false, price: 1507, quantity: 1 }],
  total: 1758,
  discountAmount: 0,
  couponCode: null,
  shippingTotal: 251,
  buyerRefunded: 0,
  isCancelled: false,
  shippingName: "Test Buyer",
  shippingLine1: "Ulica Primera 12",
  shippingLine2: null,
  shippingCity: "Demograd",
  shippingState: null,
  shippingPostalCode: "00000",
  shippingCountry: "RS",
};

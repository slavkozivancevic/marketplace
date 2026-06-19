import { notFound } from "next/navigation";
import { Link, getPathname } from "@/i18n/navigation";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { MapPin, Mail, Truck, CreditCard, ArrowLeft, RotateCcw } from "lucide-react";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgOrderById } from "@/features/orders/db/orgOrders";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrgOrderStatusManager } from "@/features/orders/components/OrgOrderStatusManager";
import { getOrgOrderReturns } from "@/features/returns/db/returns";
import { SellerReturns } from "@/features/returns/components/SellerReturns";
import { getOrgShipment } from "@/features/shipments/db/shipments";
import { ShipmentManager } from "@/features/shipments/components/ShipmentManager";
import { deriveOrderStatus } from "@/features/orders/status";
import { orderStatusKey, orderStatusVariant } from "@/features/orders/statusBadge";
import { MembershipRole } from "@/generated/prisma/client";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { getLabel } from "@/features/attributes/utils/translations";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrgOrderDetailPage({ params }: Props) {
  const t = await getTranslations("orgOrders");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const dl = dateLocale(locale);
  const { id } = await params;

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    notFound();
  }

  try {
    requirePermission(ctx, "order:read");
  } catch {
    notFound();
  }

  const order = await getOrgOrderById(id, ctx.organizationId);
  if (!order) notFound();

  // Display stage is derived from the two real axes, so legacy rows (whose
  // stored status predates the axes) still render correctly.
  const displayStatus = deriveOrderStatus({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    cancelledAt: order.cancelledAt,
  });
  const isTerminal = order.cancelledAt != null || order.paymentStatus === "REFUNDED";

  const rawReturns = await getOrgOrderReturns(order.id, ctx.organizationId);
  const shipment = await getOrgShipment(order.id, ctx.organizationId);

  // Attach localized titles to each return's lines (the order already carries
  // this seller's items with translations).
  const itemInfo = new Map(
    order.items.map((it) => {
      const title =
        it.product.translations.find((tr) => tr.locale === order.locale)?.title ??
        it.product.translations.find((tr) => tr.locale === "en")?.title ??
        "";
      const variantLabel =
        it.variant?.attributeValues
          .map((av) => getLabel(av.option.translations, order.locale))
          .join(" / ") || null;
      return [it.id, { title, variantLabel }] as const;
    }),
  );
  const returns = rawReturns.map((r) => ({
    ...r,
    items: r.items.map((ri) => {
      const info = itemInfo.get(ri.orderItemId);
      return {
        orderItemId: ri.orderItemId,
        title: info?.title ?? "",
        variantLabel: info?.variantLabel ?? null,
        quantity: ri.quantity,
      };
    }),
  }));

  const hasActiveReturn = returns.some((r) =>
    ["REQUESTED", "APPROVED", "SHIPPED"].includes(r.status),
  );

  const canManage =
    ctx.membershipRole === MembershipRole.OWNER ||
    ctx.membershipRole === MembershipRole.ADMIN;

  const shortId = `#${order.id.slice(-8).toUpperCase()}`;
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("organization"), href: getPathname({ href: "/dashboard/organization", locale }) },
    { name: tCrumbs("receivedOrders"), href: getPathname({ href: "/dashboard/organization/orders", locale }) },
    {
      name: `${tCrumbs("orderDetails")} ${shortId}`,
      href: getPathname({ href: { pathname: "/dashboard/organization/orders/[id]", params: { id } }, locale }),
    },
  ];

  const txTypeLabel: Record<string, string> = {
    CHARGE: t("txType.charge"),
    REFUND: t("txType.refund"),
    PAYOUT: t("txType.payout"),
    FEE: t("txType.fee"),
  };
  const txStatusLabel: Record<string, string> = {
    PENDING: t("txStatus.pending"),
    SUCCEEDED: t("txStatus.succeeded"),
    FAILED: t("txStatus.failed"),
  };
  const txStatusVariant = (s: string) =>
    s === "SUCCEEDED" ? ("default" as const)
    : s === "FAILED" ? ("destructive" as const)
    : ("secondary" as const);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={`${t("orderDetail")} ${shortId}`}
          description={t("placedOn", {
            date: new Date(order.createdAt).toLocaleDateString(dl, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          })}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/organization/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToOrders")}
            </Link>
          </Button>
        </PageHeader>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="max-w-2xl space-y-5">

          {/* ── Order summary ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("orderSummary")}</CardTitle>
              <div className="flex items-center gap-2">
                {order.paymentMethod === "COD" ? (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Truck className="h-3 w-3" />
                    {t("cashOnDelivery")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <CreditCard className="h-3 w-3" />
                    {t("card")}
                  </Badge>
                )}
                {hasActiveReturn && (
                  <Badge variant="outline" className="gap-1 text-xs" title={t("returnInProgress")}>
                    <RotateCcw className="h-3 w-3" />
                    {t("returnInProgress")}
                  </Badge>
                )}
                {order.paymentStatus === "PARTIALLY_REFUNDED" && (
                  <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300">
                    {t("partiallyRefunded")}
                  </Badge>
                )}
                <Badge variant={orderStatusVariant(displayStatus)}>
                  {t(orderStatusKey(displayStatus))}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("orderId")}</span>
                <span className="font-mono">{shortId}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t("date")}</span>
                <span>
                  {new Date(order.createdAt).toLocaleString(dl, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Action required (deliver / collect cash / cancel) ── */}
          {canManage && !isTerminal && (
            <OrgOrderStatusManager
              orderId={order.id}
              paymentMethod={order.paymentMethod}
              paymentStatus={order.paymentStatus}
              fulfillmentStatus={order.fulfillmentStatus}
            />
          )}

          {/* ── Fulfillment / shipping ── */}
          {canManage && !isTerminal && (
            <ShipmentManager orderId={order.id} shipment={shipment} />
          )}

          {/* ── Returns (RMA) ── */}
          {canManage && <SellerReturns returns={returns} currency={order.currency} />}

          {/* ── Payment history (ledger) ── */}
          {order.paymentTransactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t("paymentHistory")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 text-sm">
                {order.paymentTransactions.map((tx, index) => (
                  <div key={tx.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={tx.type === "REFUND" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {txTypeLabel[tx.type] ?? tx.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            {tx.provider === "COD" ? (
                              <><Truck className="h-3 w-3" />{t("cashOnDelivery")}</>
                            ) : (
                              <><CreditCard className="h-3 w-3" />{t("card")}</>
                            )}
                          </span>
                          {(tx.type === "PAYOUT" || tx.type === "FEE") && tx.refundState === "full" && (
                            <Badge variant="destructive" className="text-[10px]">
                              {t("refunded")}
                            </Badge>
                          )}
                          {(tx.type === "PAYOUT" || tx.type === "FEE") && tx.refundState === "partial" && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("partiallyRefunded")}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString(dl, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={`font-semibold tabular-nums ${
                            (tx.type === "PAYOUT" || tx.type === "FEE") && tx.refundState === "full"
                              ? "text-muted-foreground line-through"
                              : tx.type === "REFUND" || tx.type === "FEE"
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {tx.type === "REFUND" || tx.type === "FEE" ? "-" : ""}
                          {formatPrice(tx.amount, tx.currency as Currency)}
                        </span>
                        {tx.type === "PAYOUT" && tx.refundState === "partial" && (
                          <span className="text-[11px] text-destructive tabular-nums">
                            -{formatPrice(tx.reversedNet, tx.currency as Currency)}
                          </span>
                        )}
                        {tx.type === "FEE" && tx.refundState === "partial" && (
                          <span className="text-[11px] text-emerald-600 tabular-nums">
                            +{formatPrice(tx.reversedNet, tx.currency as Currency)}
                          </span>
                        )}
                        <Badge variant={txStatusVariant(tx.status)} className="text-[10px]">
                          {txStatusLabel[tx.status] ?? tx.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Your items ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("yourItems")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {order.items.map((item, index) => {
                const variantMedia = item.variant?.media[0]?.media ?? null;
                const variantImageUrl =
                  variantMedia?.thumbUrl ?? variantMedia?.url ?? null;
                const productMedia = item.product.media[0] ?? null;
                const imageUrl =
                  variantImageUrl ??
                  productMedia?.thumbUrl ??
                  productMedia?.url ??
                  null;
                const variantLabel = item.variant?.attributeValues
                  .map((av) => getLabel(av.option.translations, order.locale))
                  .join(" / ");
                const productTitle =
                  item.product.translations.find((tr) => tr.locale === order.locale)?.title ??
                  item.product.translations.find((tr) => tr.locale === "en")?.title ??
                  "";

                return (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex gap-4 items-center">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted">
                        {imageUrl && (
                          <Image src={imageUrl} alt={productTitle} fill sizes="56px" className="object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{productTitle}</p>
                        {variantLabel && (
                          <p className="text-xs text-muted-foreground">{variantLabel}</p>
                        )}
                        {item.variant?.sku && !variantLabel && (
                          <p className="text-xs text-muted-foreground">SKU: {item.variant.sku}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.price, order.currency as Currency)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-sm shrink-0">
                        {formatPrice(item.price * item.quantity, order.currency as Currency)}
                      </p>
                    </div>
                  </div>
                );
              })}

              <Separator className="my-4" />
              <div className="flex justify-between font-semibold text-sm">
                <span>{t("yourSubtotal")}</span>
                <span>{formatPrice(order.orgSubtotal, order.currency as Currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Buyer & shipping ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t("buyerAndShipping")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Buyer info */}
              <div className="space-y-1">
                {order.user.name && (
                  <p className="font-medium">{order.user.name}</p>
                )}
                <a
                  href={`mailto:${order.user.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {order.user.email}
                </a>
              </div>

              {/* Shipping address */}
              {order.shippingLine1 ? (
                <div className="space-y-0.5 text-muted-foreground">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t("deliveryAddress")}
                  </p>
                  {order.shippingName && (
                    <p className="text-foreground font-medium">{order.shippingName}</p>
                  )}
                  <p>{order.shippingLine1}</p>
                  {order.shippingLine2 && <p>{order.shippingLine2}</p>}
                  <p>
                    {[order.shippingCity, order.shippingState, order.shippingPostalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {order.shippingCountry && <p>{order.shippingCountry}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">{t("noShippingAddress")}</p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
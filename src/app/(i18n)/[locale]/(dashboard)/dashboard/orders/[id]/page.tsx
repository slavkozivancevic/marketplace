import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Link, getPathname } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";
import { MapPin, Truck, CreditCard, RotateCcw, FileText } from "lucide-react";
import { prisma } from "@/core/db/prisma";
import { getOrderById } from "@/features/orders/db/orders";
import { getReturnedQuantities, getOrderReturns } from "@/features/returns/db/returns";
import { BuyerReturns } from "@/features/returns/components/BuyerReturns";
import { getOrderShipments } from "@/features/shipments/db/shipments";
import { deriveOrderStatus } from "@/features/orders/status";
import { orderStatusKey, orderStatusVariant } from "@/features/orders/statusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { getLabel } from "@/features/attributes/utils/translations";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const dl = dateLocale(locale);
  const { id } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) notFound();

  const order = await getOrderById(id, user.id);
  if (!order) notFound();

  // Display stage derived from the two real axes (legacy rows render correctly).
  const displayStatus = deriveOrderStatus({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    cancelledAt: order.cancelledAt,
  });
  // Returns need money collected (card captured / COD cash confirmed); per-seller
  // shipment is checked below (you return received goods). A partially refunded
  // order still has returnable items left.
  const returnEligible =
    order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
  const invoiceable = order.paymentStatus !== "UNPAID";
  const [returnedQty, orderReturns, orderShipments] = await Promise.all([
    getReturnedQuantities(order.id),
    getOrderReturns(order.id),
    getOrderShipments(order.id),
  ]);
  const shipmentByOrg = new Map(orderShipments.map((s) => [s.organizationId, s]));
  const hasActiveReturn = orderReturns.some((r) =>
    ["REQUESTED", "APPROVED", "SHIPPED"].includes(r.status),
  );
  // Total refunded to the buyer (each return's refundAmount is the discounted
  // amount they actually got back), and what remains paid after refunds.
  const buyerRefunded = orderReturns
    .filter((r) => r.status === "REFUNDED")
    .reduce((sum, r) => sum + (r.refundAmount ?? 0), 0);
  const netPaid = order.total - buyerRefunded;

  // Per order item: localized title, variant label, owning seller.
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
      return [
        it.id,
        {
          title,
          variantLabel,
          organizationId: it.product.organizationId,
          orgName: it.product.organization.name,
        },
      ] as const;
    }),
  );

  // Group the order's items by seller, with each item's still-returnable qty.
  // A seller's items become returnable only once paid AND that seller's shipment
  // is DELIVERED - you return goods you've received, not ones still in transit.
  const returnSellerMap = new Map<
    string,
    { organizationId: string; name: string; shipped: boolean; delivered: boolean; canReturn: boolean; items: { orderItemId: string; title: string; variantLabel: string | null; returnable: number }[] }
  >();
  for (const it of order.items) {
    const info = itemInfo.get(it.id)!;
    let group = returnSellerMap.get(info.organizationId);
    if (!group) {
      const sh = shipmentByOrg.get(info.organizationId);
      const delivered = sh?.deliveredAt != null;
      group = {
        organizationId: info.organizationId,
        name: info.orgName,
        shipped: !!sh,
        delivered,
        canReturn: returnEligible && delivered,
        items: [],
      };
      returnSellerMap.set(info.organizationId, group);
    }
    group.items.push({
      orderItemId: it.id,
      title: info.title,
      variantLabel: info.variantLabel,
      returnable: it.quantity - (returnedQty[it.id] ?? 0),
    });
  }
  const returnSellers = [...returnSellerMap.values()];

  // Attach localized titles to each existing return's lines for display.
  const returnsForDisplay = orderReturns.map((r) => ({
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

  const isCod = order.paymentMethod === "COD";
  const shortId = `#${order.id.slice(-8).toUpperCase()}`;
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myOrders"), href: getPathname({ href: "/dashboard/orders", locale }) },
    {
      name: `${tCrumbs("orderDetails")} ${shortId}`,
      href: getPathname({ href: { pathname: "/dashboard/orders/[id]", params: { id } }, locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={`${t("orders.details")} ${shortId}`}
          description={t("orders.placedOn", {
            date: new Date(order.createdAt).toLocaleDateString(dl, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          })}
        >
          {invoiceable && (
            <Button asChild variant="outline">
              <a
                href={`/${locale}/dashboard/orders/${order.id}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="mr-2 h-4 w-4" />
                {t("invoice.download")}
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">{t("orders.backToOrders")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>{t("orders.summary")}</CardTitle>
            <div className="flex items-center gap-2">
              {isCod ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Truck className="h-3 w-3" />
                  {t("orders.cashOnDelivery")}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs">
                  <CreditCard className="h-3 w-3" />
                  {t("orders.card")}
                </Badge>
              )}
              {hasActiveReturn && (
                <Badge variant="outline" className="gap-1 text-xs" title={t("orders.returnInProgress")}>
                  <RotateCcw className="h-3 w-3" />
                  {t("orders.returnInProgress")}
                </Badge>
              )}
              {order.paymentStatus === "PARTIALLY_REFUNDED" && (
                <Badge variant="outline" className="gap-1 text-xs text-steel border-steel/40">
                  {t("orders.partiallyRefunded")}
                </Badge>
              )}
              <Badge variant={orderStatusVariant(displayStatus)}>
                {t(`orders.${orderStatusKey(displayStatus)}` as Parameters<typeof t>[0])}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>{t("orders.orderId")}</span>
              <span className="font-mono">{shortId}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("orders.date")}</span>
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

        {/* ── Shipping / fulfillment ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t("shipments.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 text-sm">
            {returnSellers.map((seller, i) => {
              const sh = shipmentByOrg.get(seller.organizationId);
              return (
                <div key={seller.organizationId}>
                  {i > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{seller.name}</span>
                    {sh?.deliveredAt ? (
                      <Badge variant="default" className="text-[10px]">{t("shipments.delivered")}</Badge>
                    ) : sh ? (
                      <Badge variant="outline" className="text-[10px]">{t("shipments.shipped")}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{t("shipments.notShipped")}</Badge>
                    )}
                  </div>
                  {sh && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <p>
                        {t("shipments.shippedOn", {
                          date: new Date(sh.shippedAt).toLocaleDateString(dl, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }),
                        })}
                      </p>
                      {sh.deliveredAt && (
                        <p>
                          {t("shipments.deliveredOn", {
                            date: new Date(sh.deliveredAt).toLocaleDateString(dl, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }),
                          })}
                        </p>
                      )}
                      {sh.carrier && <p>{t("shipments.carrier")}: {sh.carrier}</p>}
                      {sh.trackingNumber && (
                        <p>
                          {t("shipments.tracking")}: <span className="font-mono">{sh.trackingNumber}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Show the returns card once anything has shipped (so a not-yet-returnable
            seller can explain "available after delivery"), or there are returns. */}
        {(returnEligible || orderReturns.length > 0 || orderShipments.length > 0) && (
          <BuyerReturns
            orderId={order.id}
            sellers={returnSellers}
            returns={returnsForDisplay}
          />
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("orders.yourItems")}</CardTitle>
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
              // Localize each option value to the order's locale (the language
              // the buyer used), same as the title below.
              const variantLabel = item.variant?.attributeValues
                .map((av) => getLabel(av.option.translations, order.locale))
                .join(" / ");
              // Order detail page is rendered server-side with no useLocale()
              // context wired through here yet - the email already captured
              // the buyer's locale on the order row; show the title in the
              // active UI locale (falling back to default).
              const productTitle =
                item.product.translations.find((tr) => tr.locale === order.locale)?.title ??
                item.product.translations.find((tr) => tr.locale === "en")?.title ??
                "";

              return (
                <div key={item.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex gap-4 items-center">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={productTitle}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {productTitle}
                      </p>
                      {variantLabel && (
                        <p className="text-xs text-muted-foreground">
                          {variantLabel}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(item.price, order.currency as Currency)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold text-sm">
                      {formatPrice(item.price * item.quantity, order.currency as Currency)}
                    </p>
                  </div>
                </div>
              );
            })}

            <Separator className="my-4" />
            <div className="space-y-1.5">
              {(order.discountAmount > 0 || order.shippingTotal > 0) && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t("orders.subtotal")}</span>
                    {/* total = (items - discount) + shipping, so items = total + discount - shipping */}
                    <span>{formatPrice(order.total + order.discountAmount - order.shippingTotal, order.currency as Currency)}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>{t("orders.discount")}{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                      <span>-{formatPrice(order.discountAmount, order.currency as Currency)}</span>
                    </div>
                  )}
                  {order.shippingTotal > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{t("orders.shipping")}</span>
                      <span>{formatPrice(order.shippingTotal, order.currency as Currency)}</span>
                    </div>
                  )}
                </>
              )}
              {/* When items were refunded, "Your total" becomes the order's
                  original charge, then show the refunded amount and what stays
                  paid - mirrors the seller payout breakdown on the org page. */}
              <div className={`flex justify-between ${buyerRefunded > 0 ? "text-sm text-muted-foreground" : "font-semibold"}`}>
                <span>{t("orders.yourTotal")}</span>
                <span>{formatPrice(order.total, order.currency as Currency)}</span>
              </div>
              {buyerRefunded > 0 && (
                <>
                  <div className="flex justify-between text-sm text-steel">
                    <span>{t("orders.refunded")}</span>
                    <span>-{formatPrice(buyerRefunded, order.currency as Currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>{t("orders.paidAfterRefunds")}</span>
                    <span>{formatPrice(netPaid, order.currency as Currency)}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        {order.shippingLine1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                {t("orders.shippingAddress")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-0.5">
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
            </CardContent>
          </Card>
        )}

        </div>
      </div>
    </div>
  );
}


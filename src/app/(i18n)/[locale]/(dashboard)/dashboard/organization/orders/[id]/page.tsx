import { notFound } from "next/navigation";
import { Link, getPathname } from "@/i18n/navigation";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { MapPin, Mail, Truck, CreditCard, ArrowLeft } from "lucide-react";
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
import { MembershipRole } from "@/generated/prisma/client";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { getLabel } from "@/features/attributes/utils/translations";

interface Props {
  params: Promise<{ id: string }>;
}

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED": return "default" as const;
    case "CANCELLED":
    case "REFUNDED": return "destructive" as const;
    default: return "secondary" as const;
  }
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

          {/* ── Action required (COD, OWNER/ADMIN only) ── */}
          {canManage && <OrgOrderStatusManager orderId={order.id} currentStatus={order.status} />}

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
                <Badge variant={getStatusVariant(order.status)}>
                  {t(order.status.toLowerCase() as "pending" | "pending_cod" | "completed" | "cancelled" | "refunded")}
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
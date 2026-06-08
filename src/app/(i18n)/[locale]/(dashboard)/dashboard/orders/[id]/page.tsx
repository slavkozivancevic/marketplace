import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Link, getPathname } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";
import { MapPin, Truck, CreditCard } from "lucide-react";
import { prisma } from "@/core/db/prisma";
import { getOrderById } from "@/features/orders/db/orders";
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
      <div className="shrink-0 px-6 pt-2">
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
              <Badge variant={getStatusVariant(order.status)}>
                {t(`orders.${order.status.toLowerCase()}` as Parameters<typeof t>[0])}
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
            <div className="flex justify-between font-semibold">
              <span>{t("orders.yourTotal")}</span>
              <span>{formatPrice(order.total, order.currency as Currency)}</span>
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

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "CANCELLED":
    case "REFUNDED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}
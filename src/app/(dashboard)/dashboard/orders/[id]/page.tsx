import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";
import { MapPin, Truck, CreditCard } from "lucide-react";
import { prisma } from "@/core/db/prisma";
import { getOrderById } from "@/features/orders/db/orders";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const t = await getTranslations();
  const dl = dateLocale(await getLocale());
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
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
              const variantImageUrl =
                item.variant?.images[0]?.image.url ?? null;
              const imageUrl =
                variantImageUrl ?? item.product.images[0]?.url ?? null;
              const variantLabel = item.variant?.optionValues
                .map((ov) => ov.value)
                .join(" / ");

              return (
                <div key={item.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex gap-4 items-center">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {item.product.title}
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
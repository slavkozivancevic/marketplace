import { connection } from "next/server";
import Image from "next/image";
import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { auth } from "@clerk/nextjs/server";
import { AlertCircle, CheckCircle, Clock, MapPin, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingLinkButton } from "@/components/ui/pending-link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ClearCartOnSuccess } from "@/features/cart/components/ClearCartOnSuccess";
import { Footer } from "@/components/layout/footer";
import { stripe } from "@/services/stripe";
import { getOrderByStripeSessionId, getOrderById } from "@/features/orders/db/orders";
import { prisma } from "@/core/db/prisma";
import type Stripe from "stripe";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ session_id?: string; order_id?: string }>;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("checkout"), href: getPathname({ href: "/checkout", locale }) },
    { name: tCrumbs("orderConfirmation"), href: getPathname({ href: "/checkout/success", locale }) },
  ];

  const { session_id, order_id } = await searchParams;

  // ── COD success path ──────────────────────────────────────────────────────
  if (order_id && !session_id) {
    const { userId: clerkUserId } = await auth();
    const dbUser = clerkUserId
      ? await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
      : null;

    const order = dbUser ? await getOrderById(order_id, dbUser.id) : null;

    if (!order || order.paymentMethod !== "COD") {
      return (
        <>
          <div className="shrink-0 px-6 pt-2 sticky-header-bg">
            <Breadcrumbs items={breadcrumbItems} seo={false} />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
              <div className="text-center space-y-3">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold">{t("checkout.orderFailed")}</h1>
              </div>
              <PendingLinkButton
                href="/products"
                label={t("checkout.continueShopping")}
                pendingLabel={t("checkout.continueShoppingPending")}
              />
            </div>
            <Footer />
          </div>
        </>
      );
    }

    const hasShipping = !!order.shippingLine1;

    return (
      <>
        <div className="shrink-0 px-6 pt-2 sticky-header-bg">
          <Breadcrumbs items={breadcrumbItems} seo={false} />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <ClearCartOnSuccess />
          <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <Truck className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold">{t("checkout.codOrderPlaced")}</h1>
            <p className="text-muted-foreground text-sm">{t("checkout.codThankYou")}</p>
            <p className="text-muted-foreground text-xs">{t("checkout.codOrderNote")}</p>
          </div>

          {order.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  {t("checkout.orderSummary")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {order.items.map((item: typeof order.items[number], index: number) => {
                  const productTitle =
                    item.product.translations.find((tr) => tr.locale === order.locale)?.title ??
                    item.product.translations.find((tr) => tr.locale === "en")?.title ??
                    "";
                  const variantMedia = item.variant?.media[0]?.media ?? null;
                  const variantImageUrl =
                    variantMedia && variantMedia.mediaType === "IMAGE"
                      ? variantMedia.thumbUrl ?? variantMedia.url
                      : null;
                  const productMedia = item.product.media[0] ?? null;
                  const imageUrl =
                    variantImageUrl ?? productMedia?.thumbUrl ?? productMedia?.url ?? null;
                  return (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex gap-4 items-center text-sm">
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
                        <p className="font-medium">{productTitle}</p>
                        {item.variant && (
                          <p className="text-muted-foreground text-xs">{item.variant.sku}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {formatPrice(item.price, order.currency as Currency)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatPrice(item.price * item.quantity, order.currency as Currency)}
                      </p>
                    </div>
                  </div>
                  );
                })}
                <Separator className="my-4" />
                {(order.discountAmount > 0 || order.shippingTotal > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{t("checkout.subtotal")}</span>
                      <span>{formatPrice(order.total + order.discountAmount - order.shippingTotal, order.currency as Currency)}</span>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600 mt-1.5">
                        <span>{t("checkout.discount")}{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                        <span>-{formatPrice(order.discountAmount, order.currency as Currency)}</span>
                      </div>
                    )}
                    {order.shippingTotal > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground mt-1.5">
                        <span>{t("checkout.shipping")}</span>
                        <span>{formatPrice(order.shippingTotal, order.currency as Currency)}</span>
                      </div>
                    )}
                    <Separator className="my-3" />
                  </>
                )}
                <div className="flex justify-between font-semibold text-sm">
                  <span>{t("checkout.total")}</span>
                  <span>{formatPrice(order.total, order.currency as Currency)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {hasShipping && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  {t("checkout.shippingAddress")}
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

          <div className="flex flex-col gap-3">
            <PendingLinkButton
              href="/dashboard/orders"
              label={t("checkout.viewMyOrders")}
              pendingLabel={t("checkout.viewMyOrdersPending")}
            />
            <PendingLinkButton
              href="/products"
              variant="outline"
              label={t("checkout.continueShopping")}
              pendingLabel={t("checkout.continueShoppingPending")}
            />
          </div>
        </div>
        <Footer />
      </div>
      </>
    );
  }

  // ── Stripe success path (unchanged) ──────────────────────────────────────
  const [session, order] = await Promise.all([
    session_id
      ? stripe.checkout.sessions
          .retrieve(session_id, { expand: ["payment_intent.latest_charge"] })
          .catch(() => null)
      : Promise.resolve(null),
    session_id
      ? getOrderByStripeSessionId(session_id)
      : Promise.resolve(null),
  ]);

  const hasShipping = !!order?.shippingLine1;

  const paymentIntent = session?.payment_intent as Stripe.PaymentIntent | null | undefined;
  const latestCharge = paymentIntent?.latest_charge as Stripe.Charge | null | undefined;
  const isRefunded = (latestCharge?.amount_refunded ?? 0) > 0;
  const status: "success" | "refunded" | "processing" =
    order ? "success" : isRefunded ? "refunded" : "processing";

  if (status === "refunded") {
    return (
      <>
        <div className="shrink-0 px-6 pt-2 sticky-header-bg">
          <Breadcrumbs items={breadcrumbItems} seo={false} />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <AlertCircle className="h-16 w-16 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold">{t("checkout.orderFailed")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("checkout.orderFailedDesc")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <PendingLinkButton
                href="/products"
                label={t("checkout.continueShopping")}
                pendingLabel={t("checkout.continueShoppingPending")}
              />
            </div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  if (status === "processing") {
    return (
      <>
        <div className="shrink-0 px-6 pt-2 sticky-header-bg">
          <Breadcrumbs items={breadcrumbItems} seo={false} />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <Clock className="h-16 w-16 text-muted-foreground animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold">{t("checkout.processing")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("checkout.processingDesc")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild variant="outline">
                <Link
                  href={{
                    pathname: "/checkout/success",
                    query: { session_id },
                  }}
                >
                  {t("checkout.refresh")}
                </Link>
              </Button>
              <PendingLinkButton
                href="/products"
                variant="ghost"
                label={t("checkout.continueShopping")}
                pendingLabel={t("checkout.continueShoppingPending")}
              />
            </div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  // Unreachable when status === "success" (set only when `order` is non-null),
  // but narrows `order` from nullable for the success render below.
  if (!order) return null;

  return (
    <>
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <ClearCartOnSuccess />
      <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold">{t("checkout.paymentSuccessful")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("checkout.thankYou")}
          </p>
        </div>

        {order.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                {t("checkout.orderSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {order.items.map((item, index) => {
                const productTitle =
                  item.product.translations.find((tr) => tr.locale === order.locale)?.title ??
                  item.product.translations.find((tr) => tr.locale === "en")?.title ??
                  "";
                const variantMedia = item.variant?.media[0]?.media ?? null;
                const variantImageUrl =
                  variantMedia && variantMedia.mediaType === "IMAGE"
                    ? variantMedia.thumbUrl ?? variantMedia.url
                    : null;
                const productMedia = item.product.media[0] ?? null;
                const imageUrl =
                  variantImageUrl ?? productMedia?.thumbUrl ?? productMedia?.url ?? null;
                return (
                <div key={item.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex gap-4 items-center text-sm">
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
                      <p className="font-medium">{productTitle}</p>
                      {item.variant?.sku && (
                        <p className="text-muted-foreground text-xs">{item.variant.sku}</p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {formatPrice(item.price, order.currency as Currency)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatPrice(item.price * item.quantity, order.currency as Currency)}
                    </p>
                  </div>
                </div>
                );
              })}
              <Separator className="my-4" />
              {(order.discountAmount > 0 || order.shippingTotal > 0) && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t("checkout.subtotal")}</span>
                    <span>{formatPrice(order.total + order.discountAmount - order.shippingTotal, order.currency as Currency)}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 mt-1.5">
                      <span>{t("checkout.discount")}{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                      <span>-{formatPrice(order.discountAmount, order.currency as Currency)}</span>
                    </div>
                  )}
                  {order.shippingTotal > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground mt-1.5">
                      <span>{t("checkout.shipping")}</span>
                      <span>{formatPrice(order.shippingTotal, order.currency as Currency)}</span>
                    </div>
                  )}
                  <Separator className="my-3" />
                </>
              )}
              <div className="flex justify-between font-semibold text-sm">
                <span>{t("checkout.total")}</span>
                <span>{formatPrice(order.total, order.currency as Currency)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {hasShipping && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                {t("checkout.shippingAddress")}
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

        <div className="flex flex-col gap-3">
          <PendingLinkButton
            href="/dashboard/orders"
            label={t("checkout.viewMyOrders")}
            pendingLabel={t("checkout.viewMyOrdersPending")}
          />
          <PendingLinkButton
            href="/products"
            variant="outline"
            label={t("checkout.continueShopping")}
            pendingLabel={t("checkout.continueShoppingPending")}
          />
        </div>
      </div>
      <Footer />
      </div>
    </>
  );
}
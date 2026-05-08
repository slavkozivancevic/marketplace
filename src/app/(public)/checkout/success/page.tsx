import { connection } from "next/server";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { AlertCircle, CheckCircle, Clock, MapPin, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ClearCartOnSuccess } from "@/features/cart/components/ClearCartOnSuccess";
import { Footer } from "@/components/layout/footer";
import { stripe } from "@/services/stripe";
import { getOrderByStripeSessionId, getOrderById } from "@/features/orders/db/orders";
import { prisma } from "@/core/db/prisma";
import type Stripe from "stripe";

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ session_id?: string; order_id?: string }>;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  await connection();
  const t = await getTranslations();

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
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
            <div className="text-center space-y-3">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">{t("checkout.orderFailed")}</h1>
            </div>
            <Button asChild><Link href="/products">{t("checkout.continueShopping")}</Link></Button>
          </div>
          <Footer />
        </div>
      );
    }

    const hasShipping = !!order.shippingLine1;

    return (
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
                {order.items.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <p className="font-medium">{item.product.title}</p>
                        {item.variant && (
                          <p className="text-muted-foreground text-xs">{item.variant.sku}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                <Separator className="my-4" />
                <div className="flex justify-between font-semibold text-sm">
                  <span>{t("checkout.total")}</span>
                  <span>${order.total.toFixed(2)}</span>
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
            <Button asChild>
              <Link href="/dashboard/orders">{t("checkout.viewMyOrders")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/products">{t("checkout.continueShopping")}</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Stripe success path (unchanged) ──────────────────────────────────────
  const [session, order] = await Promise.all([
    session_id
      ? stripe.checkout.sessions
          .retrieve(session_id, { expand: ["line_items", "payment_intent.latest_charge"] })
          .catch(() => null)
      : Promise.resolve(null),
    session_id
      ? getOrderByStripeSessionId(session_id)
      : Promise.resolve(null),
  ]);

  const lineItems = session?.line_items?.data ?? [];
  const total = (session?.amount_total ?? 0) / 100;
  const hasShipping = !!order?.shippingLine1;

  const paymentIntent = session?.payment_intent as Stripe.PaymentIntent | null | undefined;
  const latestCharge = paymentIntent?.latest_charge as Stripe.Charge | null | undefined;
  const isRefunded = (latestCharge?.amount_refunded ?? 0) > 0;
  const status: "success" | "refunded" | "processing" =
    order ? "success" : isRefunded ? "refunded" : "processing";

  if (status === "refunded") {
    return (
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
            <Button asChild>
              <Link href="/products">{t("checkout.continueShopping")}</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (status === "processing") {
    return (
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
              <Link href={`/checkout/success?session_id=${session_id}`}>
                {t("checkout.refresh")}
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/products">{t("checkout.continueShopping")}</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
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

        {lineItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                {t("checkout.orderSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {lineItems.map((item, index) => (
                <div key={item.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-muted-foreground text-xs">
                        ${((item.amount_total ?? 0) / 100 / (item.quantity ?? 1)).toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold">
                      ${((item.amount_total ?? 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              <Separator className="my-4" />
              <div className="flex justify-between font-semibold text-sm">
                <span>{t("checkout.total")}</span>
                <span>${total.toFixed(2)}</span>
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
          <Button asChild>
            <Link href="/dashboard/orders">{t("checkout.viewMyOrders")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products">{t("checkout.continueShopping")}</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
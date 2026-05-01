import { connection } from "next/server";
import Link from "next/link";
import { CheckCircle, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ClearCartOnSuccess } from "@/features/cart/components/ClearCartOnSuccess";
import { Footer } from "@/components/layout/footer";
import { stripe } from "@/services/stripe";
import { getOrderByStripeSessionId } from "@/features/orders/db/orders";

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  await connection();

  const { session_id } = await searchParams;

  // Fetch line items from Stripe and shipping from DB in parallel
  const [session, order] = await Promise.all([
    session_id
      ? stripe.checkout.sessions
          .retrieve(session_id, { expand: ["line_items"] })
          .catch(() => null)
      : Promise.resolve(null),
    session_id
      ? getOrderByStripeSessionId(session_id)
      : Promise.resolve(null),
  ]);

  const lineItems = session?.line_items?.data ?? [];
  const total = (session?.amount_total ?? 0) / 100;

  const hasShipping = !!order?.shippingLine1;

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <ClearCartOnSuccess />
      <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold">Payment Successful</h1>
          <p className="text-muted-foreground text-sm">
            Thank you for your order! A confirmation email has been sent to you.
          </p>
        </div>

        {lineItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Order Summary
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
                <span>Total</span>
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
                Shipping Address
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
            <Link href="/dashboard/orders">View My Orders</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
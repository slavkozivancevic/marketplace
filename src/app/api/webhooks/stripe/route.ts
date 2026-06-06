import { headers } from "next/headers";
import { stripe } from "@/services/stripe";
import { env } from "@/env/server";
import { fulfillOrder, refundOrder } from "@/features/orders/db/orders";
import { publishOrderCompleted, publishOrderRefunded } from "@/services/notifications";
import {
  isWebhookProcessed,
  markWebhookProcessed,
} from "@/features/webhooks/webhookEvents";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("Processing Stripe webhook:", event.type, event.id);

  if (await isWebhookProcessed(event.id)) {
    console.log("Stripe webhook already processed:", event.id);
    return new Response("OK", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const itemsJson = session.metadata?.items;
        const locale = session.metadata?.locale ?? "en";
        const currency = session.metadata?.currency ?? "usd";
        const exchangeRate = parseFloat(session.metadata?.exchangeRate ?? "1");

        if (!userId || !itemsJson) {
          console.error("Missing metadata in checkout session", session.id);
          return new Response("Missing metadata", { status: 400 });
        }

        const items = JSON.parse(itemsJson) as {
          productId: string;
          variantId: string | null;
          quantity: number;
        }[];

        const shippingDetails = session.collected_information?.shipping_details;
        const shipping = shippingDetails
          ? {
              name: shippingDetails.name ?? null,
              line1: shippingDetails.address?.line1 ?? null,
              line2: shippingDetails.address?.line2 ?? null,
              city: shippingDetails.address?.city ?? null,
              state: shippingDetails.address?.state ?? null,
              postalCode: shippingDetails.address?.postal_code ?? null,
              country: shippingDetails.address?.country ?? null,
            }
          : undefined;

        let order;
        try {
          order = await fulfillOrder({
            userId,
            stripeSessionId: session.id,
            totalCents: session.amount_total ?? 0,
            currency,
            exchangeRate,
            items,
            shipping,
            locale,
          });
          console.log("Order fulfilled for session:", session.id);
        } catch (fulfillError) {
          const isStockError =
            fulfillError instanceof Error &&
            fulfillError.message.startsWith("Insufficient stock");

          if (isStockError) {
            const paymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id;

            if (paymentIntentId) {
              try {
                await stripe.refunds.create({ payment_intent: paymentIntentId });
                console.log(
                  "Auto-refunded session due to insufficient stock:",
                  session.id,
                );
              } catch (refundError) {
                console.error(
                  "Failed to auto-refund session:",
                  session.id,
                  refundError,
                );
              }
            }
            // Mark as processed so Stripe does not retry - refund is already issued
            break;
          }

          throw fulfillError;
        }

        // Publish to notification service - fire-and-forget so SNS failures
        // don't cause Stripe to retry the webhook.
        // The notification Lambda fetches full order context and sends
        // both the buyer confirmation and seller notification emails.
        if (order) {
          publishOrderCompleted(order.id, locale, currency).catch((err) =>
            console.error("[notifications] publishOrderCompleted failed", JSON.stringify(err, null, 2), err)
          );
        }

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session expired:", session.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (!paymentIntentId) {
          console.error("No payment_intent on charge", charge.id);
          break;
        }

        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });

        const sessionId = sessions.data[0]?.id;

        if (!sessionId) {
          console.error(
            "No checkout session found for payment_intent",
            paymentIntentId,
          );
          break;
        }

        const refunded = await refundOrder(sessionId);
        if (refunded) {
          console.log("Order refunded for session:", sessionId);
          publishOrderRefunded(refunded.id, refunded.locale ?? "en").catch((err) =>
            console.error("[notifications] publishOrderRefunded failed", err)
          );
        }
        break;
      }

      default:
        console.log("Unhandled Stripe event type:", event.type);
    }

    await markWebhookProcessed(event.id, event.type);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return new Response("Internal Error", { status: 500 });
  }
}

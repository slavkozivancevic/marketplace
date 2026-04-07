import { headers } from "next/headers";
import { stripe } from "@/services/stripe";
import { env } from "@/env/server";
import { fulfillOrder } from "@/features/orders/db/orders";
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const itemsJson = session.metadata?.items;

        if (!userId || !itemsJson) {
          console.error("Missing metadata in checkout session", session.id);
          return new Response("Missing metadata", { status: 400 });
        }

        const items = JSON.parse(itemsJson) as {
          productId: string;
          variantId: string | null;
          quantity: number;
        }[];

        await fulfillOrder({
          userId,
          stripeSessionId: session.id,
          totalCents: session.amount_total ?? 0,
          items,
        });

        console.log("Order fulfilled for session:", session.id);
        break;
      }

      default:
        console.log("Unhandled Stripe event type:", event.type);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return new Response("Internal Error", { status: 500 });
  }
}

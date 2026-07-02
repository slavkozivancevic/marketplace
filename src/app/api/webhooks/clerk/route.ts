import { logger } from "@/lib/logger";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { env } from "@/env/server";
import {
  createOrUpdateUserFromClerk,
  deleteUser,
} from "@/features/users/db/users";
import { syncClerkUserMetadata } from "@/services/clerk";
import {
  isWebhookProcessed,
  markWebhookProcessed,
} from "@/features/webhooks/webhookEvents";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/core/db/prisma";

export async function POST(req: Request) {
  const headerPayload = await headers();

  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error("Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  logger.info("Processing webhook:", {
    svixId,
    type: event.type,
  });

  if (await isWebhookProcessed(svixId)) {
    logger.info("Webhook already processed");
    return new Response("OK", { status: 200 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const primaryEmail = event.data.email_addresses.find(
          (email) => email.id === event.data.primary_email_address_id,
        )?.email_address;

        if (!primaryEmail) {
          return new Response("No email", { status: 400 });
        }

        const name = `${event.data.first_name ?? ""} ${
          event.data.last_name ?? ""
        }`.trim();

        const role: UserRole =
          event.data.public_metadata?.role === "ADMIN"
            ? "ADMIN"
            : event.data.public_metadata?.role === "SELLER"
              ? "SELLER"
              : "USER";

        const user = await createOrUpdateUserFromClerk({
          clerkUserId: event.data.id,
          email: primaryEmail,
          name,
          imageUrl: event.data.image_url,
          role,
        });

        if (!user) {
          return new Response("User sync failed", { status: 500 });
        }

        const orgId =
          event.data.public_metadata?.activeOrgId ??
          (user.memberships.length > 0 ? user.memberships[0].orgId : null);

        if (!orgId) {
          return new Response("Membership organization not resolved", {
            status: 400,
          });
        }

        const membership = await prisma.membership.findUnique({
          where: {
            userId_orgId: {
              userId: user.id,
              orgId,
            },
          },
        });

        if (!membership) {
          return new Response("Membership missing", { status: 400 });
        }

        const metadata = event.data.public_metadata;

        if (
          metadata?.dbId !== user.id ||
          metadata?.role !== user.role ||
          metadata?.activeOrgId !== orgId
        ) {
          await syncClerkUserMetadata({
            clerkUserId: event.data.id,
            dbId: user.id,
            role: user.role,
            activeOrgId: orgId,
          });
        }

        break;
      }

      case "user.deleted": {
        if (event.data.id) {
          await deleteUser(event.data.id);
        }
        break;
      }
    }

    await markWebhookProcessed(svixId, event.type);

    return new Response("OK", { status: 200 });
  } catch (error) {
    logger.error(error);
    return new Response("Internal Error", { status: 500 });
  }
}

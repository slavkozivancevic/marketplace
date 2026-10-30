import { clerkClient } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";
import { createOrUpdateUserFromClerk, deleteUser } from "@/features/users/db/users";
import { syncClerkUserMetadata } from "@/services/clerk";
import {
  DEMO_ACCOUNTS,
  VISITOR_BUYER_EMAIL_QUERY,
  isVisitorBuyerEmail,
  newDemoBuyerIdentity,
} from "./demoAccounts";
import { pickDemoBuyersToRetire } from "./demoBuyerPolicy";

/**
 * Retires old visitor buyers, piggybacked on the next "Buyer" click instead of
 * a cron: nothing runs while nobody visits, which is the zero-cost design.
 * Best-effort - a failure here must not keep the visitor out of the demo.
 *
 * The list comes from Clerk, not from our database: the development instance
 * is shared by local and staging, each with its own database, and it is
 * Clerk's 100-user ceiling that has to be kept clear - so buyers made by
 * either environment are counted and retired by whichever one is clicked.
 */
export async function retireDemoBuyers(now = new Date()): Promise<void> {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({
    query: VISITOR_BUYER_EMAIL_QUERY,
    limit: 100,
  });
  const ids = pickDemoBuyersToRetire(
    data
      .filter((u) => u.emailAddresses.some((e) => isVisitorBuyerEmail(e.emailAddress)))
      .map((u) => ({ clerkUserId: u.id, createdAt: new Date(u.createdAt) })),
    now,
  );

  for (const clerkUserId of ids) {
    try {
      // Clerk first: once its user is gone nobody can sign in as it, and our
      // row (orders stay, under "Deleted User") follows right after - a no-op
      // when the other environment made it. Clerk's user.deleted webhook may
      // run deleteUser again; it is a no-op by then.
      await clerk.users.deleteUser(clerkUserId).catch((err: unknown) => {
        if ((err as { status?: number }).status !== 404) throw err;
      });
      await deleteUser(clerkUserId);
    } catch (err) {
      logger.error("[demo] retiring a visitor buyer failed", { clerkUserId, err });
    }
  }
}

/**
 * A new buyer for one visitor: the Clerk user, then our row and its personal
 * organization written here rather than left to the webhook - the Clerk
 * development instance is shared by local and staging, so the webhook may be
 * delivered to the other one. Returns the Clerk user id to mint a ticket for.
 */
export async function createDemoBuyer(): Promise<string> {
  const { email, code } = newDemoBuyerIdentity();
  const { firstName, lastName } = DEMO_ACCOUNTS.buyer;
  const clerk = await clerkClient();
  const cu = await clerk.users.createUser({
    emailAddress: [email],
    firstName,
    lastName: `${lastName} ${code}`,
    skipPasswordRequirement: true,
    publicMetadata: { role: "USER" },
  });

  const user = await createOrUpdateUserFromClerk({
    clerkUserId: cu.id,
    email,
    name: `${firstName} ${lastName} ${code}`,
    imageUrl: cu.imageUrl,
    role: "USER",
  });
  const activeOrgId = user?.activeOrgId ?? user?.memberships[0]?.orgId;
  if (!user || !activeOrgId) throw new Error("Visitor buyer was not written to the database");
  await syncClerkUserMetadata({ clerkUserId: cu.id, dbId: user.id, role: "USER", activeOrgId });
  return cu.id;
}

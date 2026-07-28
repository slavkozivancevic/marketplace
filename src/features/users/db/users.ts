import { prisma } from "@/core/db/prisma";
import { cacheTag, revalidatePath } from "next/cache";
import { revalidateUserCache } from "./cache";
import { revalidateOrganizationCache } from "@/features/organizations/db/cache";
import { syncClerkUserMetadata } from "@/services/clerk";
import { CacheTags } from "@/lib/cache/tags";
import { UserRole } from "../schema/users";
import { logger } from "@/lib/logger";
import { recordAudit, SYSTEM_ACTOR } from "@/features/audit/db/audit";
import { publishOwnerAutoPromoted, publishMemberRemoved } from "@/services/notifications";

/* ================= READ ================= */

export async function getUserById(id: string) {
  "use cache";

  cacheTag(CacheTags.users.all());
  cacheTag(CacheTags.users.byId(id));

  return prisma.user.findUnique({
    where: { id, deletedAt: null },
    include: { memberships: true },
  });
}

export async function getUserByClerkId(clerkUserId: string) {
  "use cache";

  cacheTag(CacheTags.users.all());
  cacheTag(CacheTags.users.byClerkId(clerkUserId));

  return prisma.user.findUnique({
    where: { clerkUserId, deletedAt: null },
    include: { memberships: true },
  });
}

export async function getAllUsers() {
  "use cache";

  cacheTag(CacheTags.users.all());

  return prisma.user.findMany({
    where: { deletedAt: null },
    include: { memberships: { include: { organization: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/* ================= WRITE ================= */

export async function createOrUpdateUserFromClerk(params: {
  clerkUserId: string;
  email: string;
  name: string;
  imageUrl: string | null;
  role: UserRole;
}) {
  const user = await prisma.$transaction(async (tx) => {
    const dbUser = await tx.user.upsert({
      where: { clerkUserId: params.clerkUserId },
      update: {
        email: params.email,
        name: params.name,
        imageUrl: params.imageUrl,
        role: params.role,
        deletedAt: null,
      },
      create: {
        clerkUserId: params.clerkUserId,
        email: params.email,
        name: params.name,
        imageUrl: params.imageUrl,
        role: params.role,
      },
    });

    const membershipCount = await tx.membership.count({
      where: { userId: dbUser.id },
    });

    if (membershipCount === 0) {
      const organization = await tx.organization.create({
        data: {
          name: params.name
            ? `${params.name}'s Organization`
            : "My Organization",
          verified: params.role === "SELLER",
        },
      });

      await tx.membership.create({
        data: {
          userId: dbUser.id,
          orgId: organization.id,
          role: "OWNER",
        },
      });

      await tx.user.update({
        where: { id: dbUser.id },
        data: { activeOrgId: organization.id },
      });

      revalidateOrganizationCache(organization.id);
    }

    return tx.user.findUnique({
      where: { id: dbUser.id },
      include: { memberships: true },
    });
  });

  if (user) {
    revalidateUserCache(user.id, params.clerkUserId);
    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/admin", "page");
  }

  return user;
}

export async function switchActiveOrg(userId: string, orgId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { activeOrgId: orgId },
  });

  revalidateUserCache(user.id, user.clerkUserId);

  return user;
}

type DeleteUserOutcome =
  | { kind: "org_deleted"; orgId: string; orgName: string }
  | { kind: "catalog_deactivated"; orgId: string; orgName: string; productCount: number }
  | { kind: "owner_promoted"; orgId: string; orgName: string; promotedUserId: string }
  | { kind: "member_removed"; orgId: string; orgName: string; role: string };

export async function deleteUser(clerkUserId: string) {
  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!existingUser) return null;

  // Collected during the transaction, acted on after it commits - audit
  // writes and SNS publishes must not run inside $transaction (see
  // reconcileStripeRefund for the same pattern elsewhere in this codebase).
  const outcomes: DeleteUserOutcome[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({
      where: { createdById: existingUser.id, status: "PENDING" },
      data: { status: "CANCELED" },
    });

    for (const membership of existingUser.memberships) {
      if (membership.role !== "OWNER") {
        await tx.membership.delete({
          where: { userId_orgId: { userId: existingUser.id, orgId: membership.orgId } },
        });
        outcomes.push({
          kind: "member_removed",
          orgId: membership.orgId,
          orgName: membership.organization.name,
          role: membership.role,
        });
        continue;
      }

      const otherOwners = await tx.membership.count({
        where: {
          orgId: membership.orgId,
          role: "OWNER",
          userId: { not: existingUser.id },
        },
      });

      if (otherOwners > 0) {
        await tx.membership.delete({
          where: { userId_orgId: { userId: existingUser.id, orgId: membership.orgId } },
        });
        outcomes.push({
          kind: "member_removed",
          orgId: membership.orgId,
          orgName: membership.organization.name,
          role: "OWNER",
        });
        continue;
      }

      // Sole owner, but the org isn't necessarily a one-person operation -
      // it may still have ADMIN/MEMBER staff. Keep the business running by
      // promoting the most senior remaining member (ADMIN over MEMBER) to
      // OWNER, the same compensating control GitHub/AWS-style orgs use when
      // a sole owner's account goes away. Only fall back to
      // deactivating/deleting the org when truly nobody is left to hand it to.
      const promotable = await tx.membership.findFirst({
        where: {
          orgId: membership.orgId,
          userId: { not: existingUser.id },
          role: { in: ["ADMIN", "MEMBER"] },
        },
        // enum order OWNER, ADMIN, MEMBER -> ADMIN before MEMBER; within the
        // same role, the longest-tenured member goes first.
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { userId: true },
      });

      if (promotable) {
        await tx.membership.update({
          where: { userId_orgId: { userId: promotable.userId, orgId: membership.orgId } },
          data: { role: "OWNER" },
        });
        await tx.membership.delete({
          where: { userId_orgId: { userId: existingUser.id, orgId: membership.orgId } },
        });
        outcomes.push({
          kind: "owner_promoted",
          orgId: membership.orgId,
          orgName: membership.organization.name,
          promotedUserId: promotable.userId,
        });
        continue;
      }

      // Truly solo org - nobody left to hand it to.
      await tx.invite.updateMany({
        where: { orgId: membership.orgId, status: "PENDING" },
        data: { status: "CANCELED" },
      });

      // Organization.id is ON DELETE RESTRICT from Product/Shipment/Return,
      // and ConnectedAccount cascades. A hard delete only succeeds for a
      // truly empty org - any org that has ever sold something would throw
      // mid-transaction and roll back the whole deleteUser call (leaving
      // the Clerk-deleted user's row live in our DB). Check first instead
      // of relying on the FK error.
      const [productCount, shipmentCount, returnCount, connectedAccount] =
        await Promise.all([
          tx.product.count({ where: { organizationId: membership.orgId } }),
          tx.shipment.count({ where: { organizationId: membership.orgId } }),
          tx.return.count({ where: { organizationId: membership.orgId } }),
          tx.connectedAccount.findUnique({
            where: { organizationId: membership.orgId },
          }),
        ]);

      if (
        productCount === 0 &&
        shipmentCount === 0 &&
        returnCount === 0 &&
        !connectedAccount
      ) {
        await tx.membership.deleteMany({
          where: { orgId: membership.orgId },
        });

        await tx.organization.delete({
          where: { id: membership.orgId },
        });
        outcomes.push({
          kind: "org_deleted",
          orgId: membership.orgId,
          orgName: membership.organization.name,
        });
      } else {
        // Org has real history - can't hard-delete it. Soft-delete its
        // live catalog so the storefront stops selling on behalf of an
        // org nobody can manage, but keep the org/orders/payouts intact
        // for admins to reassign or wind down.
        await tx.product.updateMany({
          where: { organizationId: membership.orgId, deletedAt: null },
          data: { deletedAt: new Date(), updatedById: existingUser.id },
        });

        await tx.membership.delete({
          where: { userId_orgId: { userId: existingUser.id, orgId: membership.orgId } },
        });
        outcomes.push({
          kind: "catalog_deactivated",
          orgId: membership.orgId,
          orgName: membership.organization.name,
          productCount,
        });
      }
    }

    await tx.user.update({
      where: { clerkUserId },
      data: {
        deletedAt: new Date(),
        email: `deleted-${existingUser.id}@deleted.local`,
        name: "Deleted User",
        imageUrl: null,
      },
    });
  });

  for (const membership of existingUser.memberships) {
    revalidateOrganizationCache(membership.orgId);
  }

  revalidateUserCache(existingUser.id, existingUser.clerkUserId);

  // Post-commit: audit trail (always) + email (only when there's someone new
  // to tell - a deactivated solo org has nobody left on the org side, so
  // that case is audit-only, same as the org-deleted/member-removed cases).
  for (const outcome of outcomes) {
    await recordAudit({
      action: `organization.${outcome.kind}`,
      entityType: "Organization",
      entityId: outcome.orgId,
      diff: { ...outcome, deletedClerkUserId: clerkUserId },
      actor: SYSTEM_ACTOR,
    }).catch((err) => logger.error("[deleteUser] recordAudit failed", err));

    if (outcome.kind === "owner_promoted") {
      const promoted = await prisma.user.findUnique({
        where: { id: outcome.promotedUserId },
        select: { email: true, name: true, locale: true },
      });
      if (promoted) {
        publishOwnerAutoPromoted({
          userEmail: promoted.email,
          userName: promoted.name,
          organizationName: outcome.orgName,
          locale: promoted.locale ?? "en",
        }).catch((err) => logger.error("[deleteUser] publishOwnerAutoPromoted failed", err));
      }
    }

    if (outcome.kind === "member_removed") {
      // Tell the org's remaining OWNER(s)/ADMIN(s) a team member's account
      // was closed - security-relevant even when it's not the owner (staff
      // offboarding, unexpected departures). Plain MEMBERs aren't notified,
      // same as they don't see the member-management UI either.
      const recipients = await prisma.membership.findMany({
        where: { orgId: outcome.orgId, role: { in: ["OWNER", "ADMIN"] } },
        select: { user: { select: { email: true, name: true, locale: true } } },
      });
      for (const recipient of recipients) {
        publishMemberRemoved({
          recipientEmail: recipient.user.email,
          recipientName: recipient.user.name,
          organizationName: outcome.orgName,
          removedUserName: existingUser.name,
          removedUserEmail: existingUser.email,
          removedRole: outcome.role,
          locale: recipient.user.locale ?? "en",
        }).catch((err) => logger.error("[deleteUser] publishMemberRemoved failed", err));
      }
    }
  }

  return existingUser;
}

export async function updateUserRole(userId: string, role: UserRole) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!existing) {
    throw new Error(`User ${userId} not found`);
  }

  const oldRole = existing.role;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  const activeOrgId = user.activeOrgId ?? user.memberships[0]?.orgId ?? null;

  for (const membership of user.memberships) {
    if (
      role === "SELLER" &&
      membership.role === "OWNER" &&
      !membership.organization.verified
    ) {
      await prisma.organization.update({
        where: { id: membership.orgId },
        data: { verified: true },
      });
    }

    revalidateOrganizationCache(membership.orgId);
  }

  if (activeOrgId) {
    await syncClerkUserMetadata({
      clerkUserId: user.clerkUserId,
      dbId: user.id,
      role: user.role,
      activeOrgId,
    });
  }

  revalidateUserCache(user.id, user.clerkUserId);

  return {
    user,
    oldRole,
    newRole: role,
    roleChanged: oldRole !== role,
  };
}

import { prisma } from "@/core/db/prisma";
import { cacheTag, revalidatePath } from "next/cache";
import { revalidateUserCache } from "./cache";
import { revalidateOrganizationCache } from "@/features/organizations/db/cache";
import { syncClerkUserMetadata } from "@/services/clerk";
import { CacheTags } from "@/lib/cache/tags";
import { UserRole } from "../schema/users";

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

  await prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({
      where: { createdById: existingUser.id, status: "PENDING" },
      data: { status: "CANCELED" },
    });

    for (const membership of existingUser.memberships) {
      if (membership.role === "OWNER") {
        const otherOwners = await tx.membership.count({
          where: {
            orgId: membership.orgId,
            role: "OWNER",
            userId: { not: existingUser.id },
          },
        });

        if (otherOwners === 0) {
          await tx.invite.updateMany({
            where: { orgId: membership.orgId, status: "PENDING" },
            data: { status: "CANCELED" },
          });

          await tx.membership.deleteMany({
            where: { orgId: membership.orgId },
          });

          await tx.organization.delete({
            where: { id: membership.orgId },
          });
        } else {
          await tx.membership.delete({
            where: {
              userId_orgId: {
                userId: existingUser.id,
                orgId: membership.orgId,
              },
            },
          });
        }
      } else {
        await tx.membership.delete({
          where: {
            userId_orgId: {
              userId: existingUser.id,
              orgId: membership.orgId,
            },
          },
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

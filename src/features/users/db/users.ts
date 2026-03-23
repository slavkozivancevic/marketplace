import { prisma } from "@/core/db/prisma";
import { cacheTag } from "next/cache";
import { getUserGlobalTag, getUserIdTag, revalidateUserCache } from "./cache";
import { syncClerkUserMetadata } from "@/services/clerk";
import { UserRole } from "../schema/users";

/* ================= READ ================= */

export async function getUserById(id: string) {
  "use cache";

  cacheTag(getUserIdTag(id));
  cacheTag(getUserGlobalTag());

  return prisma.user.findUnique({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      memberships: true,
    },
  });
}

export async function getUserByClerkId(clerkUserId: string) {
  "use cache";

  cacheTag(getUserGlobalTag());

  return prisma.user.findUnique({
    where: {
      clerkUserId,
      deletedAt: null,
    },
    include: {
      memberships: true,
    },
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
          verified: true,
        },
      });

      await tx.membership.create({
        data: {
          userId: dbUser.id,
          orgId: organization.id,
          role: "OWNER",
        },
      });
    }

    return tx.user.findUnique({
      where: { id: dbUser.id },
      include: {
        memberships: true,
      },
    });
  });

  if (user) {
    revalidateUserCache(user.id);
  }

  return user;
}

export async function deleteUser(clerkUserId: string) {
  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!existingUser) {
    return null;
  }

  const user = await prisma.user.update({
    where: { clerkUserId },
    data: {
      deletedAt: new Date(),
      email: `deleted-${existingUser.id}@deleted.local`,
      name: "Deleted User",
      imageUrl: null,
    },
  });

  revalidateUserCache(user.id);

  return user;
}

export async function updateUserRole(userId: string, role: UserRole) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    include: { memberships: true },
  });

  const activeOrgId = user.memberships[0]?.orgId ?? null;

  await syncClerkUserMetadata({
    clerkUserId: user.clerkUserId,
    dbId: user.id,
    role: user.role,
    activeOrgId,
  });

  revalidateUserCache(user.id);

  return user;
}

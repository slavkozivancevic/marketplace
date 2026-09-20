import { prisma } from "@/core/db/prisma";
import { MembershipRole, Prisma } from "@/generated/prisma/client";
import { serializeMoney, type MoneySet } from "@/lib/money";
import { NotFoundError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { revalidateOrganizationCache, revalidateOrganizationMembers } from "./cache";
import { revalidateUserCache } from "@/features/users/db/cache";
import { reassignActiveOrg } from "./activeOrg";

export async function getAllOrganizations() {
  return prisma.organization.findMany({
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              imageUrl: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });
}

export async function setOrganizationVerified(id: string, verified: boolean) {
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    throw new NotFoundError(`Organization ${id} not found`);
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: { verified },
  });

  revalidateOrganizationCache(id);

  return updated;
}

/**
 * The people an org tells about a membership change: its OWNER(s) and ADMIN(s).
 * Plain MEMBERs are left out, matching who can see the member-management UI in
 * the first place. `excludeUserId` drops the person who performed the change -
 * an email reporting your own click back to you is noise.
 */
export async function listMemberManagers(
  orgId: string,
  options: { excludeUserId?: string } = {},
) {
  const memberships = await prisma.membership.findMany({
    where: {
      orgId,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
    },
    select: { user: { select: { email: true, name: true, locale: true } } },
  });

  return memberships.map((m) => m.user);
}

/**
 * Returns who was removed, so the caller can tell them. The read has to happen
 * before the delete - once the membership row is gone there is nothing left to
 * join the user's email and locale from, and the email is recipient-targeted
 * (it renders in the removed member's own language, not the acting admin's).
 */
export async function removeMember(targetUserId: string, orgId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: targetUserId, orgId } },
    include: {
      user: {
        select: {
          clerkUserId: true,
          email: true,
          name: true,
          locale: true,
          role: true,
        },
      },
      organization: { select: { name: true } },
    },
  });

  if (!membership) throw new NotFoundError("Member not found");
  if (membership.role === MembershipRole.OWNER) {
    throw new ForbiddenError({ key: "cannotRemoveOwner" });
  }

  // One transaction, because losing the membership and being moved off the org
  // are the same event. Split them and a member who was working in this org is
  // left pointing at it with no membership to back the pointer - the state that
  // made an org's sole owner look like a permissionless guest in her own shop.
  const { changed, activeOrgId } = await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });

    return reassignActiveOrg(tx, targetUserId, orgId);
  });

  revalidateOrganizationMembers(orgId);
  // The dashboard layout caches the user row (users.byClerkId) to build the org
  // switcher, so without this the sidebar keeps offering the org they just lost.
  revalidateUserCache(targetUserId, membership.user.clerkUserId);

  return {
    removedRole: membership.role,
    userId: targetUserId,
    userClerkId: membership.user.clerkUserId,
    userEmail: membership.user.email,
    userName: membership.user.name,
    userLocale: membership.user.locale,
    userRole: membership.user.role,
    activeOrgChanged: changed,
    newActiveOrgId: activeOrgId,
    organizationName: membership.organization.name,
  };
}

export async function updateMemberRole(
  targetUserId: string,
  orgId: string,
  role: MembershipRole
) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: targetUserId, orgId } },
    include: {
      user: { select: { email: true, name: true, locale: true } },
      organization: { select: { name: true } },
    },
  });

  if (!membership) throw new NotFoundError("Member not found");
  if (membership.role === MembershipRole.OWNER) {
    throw new ForbiddenError({ key: "cannotChangeOwnerRole" });
  }
  if (role === MembershipRole.OWNER) {
    throw new ForbiddenError({ key: "cannotAssignOwnerRole" });
  }

  await prisma.membership.update({
    where: { userId_orgId: { userId: targetUserId, orgId } },
    data: { role },
  });

  revalidateOrganizationMembers(orgId);

  return {
    oldRole: membership.role,
    newRole: role,
    userEmail: membership.user.email,
    userName: membership.user.name,
    userLocale: membership.user.locale,
    organizationName: membership.organization.name,
  };
}

/**
 * Per-seller delivery rule. Each value arrives as a MoneySet (the exact fee per
 * currency) plus its USD-cent mirror, and both are written together so the
 * mirror the free-shipping comparison reads can never disagree with the amount
 * the buyer is actually charged. Threshold null = never free.
 */
export async function updateOrganizationShipping(
  id: string,
  data: {
    shippingFlatRate: number;
    shippingFlatRateMoney: MoneySet;
    shippingFreeThreshold: number | null;
    shippingFreeThresholdMoney: MoneySet | null;
  },
) {
  const updated = await prisma.organization.update({
    where: { id },
    data: {
      shippingFlatRate: data.shippingFlatRate,
      shippingFlatRateMoney: serializeMoney(data.shippingFlatRateMoney),
      shippingFreeThreshold: data.shippingFreeThreshold,
      shippingFreeThresholdMoney: data.shippingFreeThresholdMoney
        ? serializeMoney(data.shippingFreeThresholdMoney)
        : Prisma.DbNull,
    },
  });
  revalidateOrganizationCache(id);
  return updated;
}

export async function updateOrganizationName(id: string, name: string) {
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    throw new NotFoundError(`Organization ${id} not found`);
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: { name },
  });

  revalidateOrganizationCache(id);

  return updated;
}
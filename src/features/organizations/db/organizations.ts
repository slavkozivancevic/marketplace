import { prisma } from "@/core/db/prisma";
import { MembershipRole, Prisma } from "@/generated/prisma/client";
import { serializeMoney, type MoneySet } from "@/lib/money";
import { NotFoundError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { revalidateOrganizationCache, revalidateOrganizationMembers } from "./cache";

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

export async function removeMember(targetUserId: string, orgId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: targetUserId, orgId } },
  });

  if (!membership) throw new NotFoundError("Member not found");
  if (membership.role === MembershipRole.OWNER) {
    throw new ForbiddenError({ key: "cannotRemoveOwner" });
  }

  await prisma.membership.delete({
    where: { userId_orgId: { userId: targetUserId, orgId } },
  });

  revalidateOrganizationMembers(orgId);
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
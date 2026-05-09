import { prisma } from "@/core/db/prisma";
import { MembershipRole } from "@/generated/prisma/client";
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
    throw new ForbiddenError("Cannot remove the organization owner");
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
      user: { select: { email: true, name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!membership) throw new NotFoundError("Member not found");
  if (membership.role === MembershipRole.OWNER) {
    throw new ForbiddenError("Cannot change the owner's role");
  }
  if (role === MembershipRole.OWNER) {
    throw new ForbiddenError("Cannot assign owner role directly");
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
    organizationName: membership.organization.name,
  };
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
import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateOrganizationCache } from "./cache";

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

  const updatedOrganization = await prisma.organization.update({
    where: { id },
    data: { verified },
  });

  revalidateOrganizationCache(id);

  return updatedOrganization;
}

export async function updateOrganizationName(id: string, name: string) {
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    throw new NotFoundError(`Organization ${id} not found`);
  }

  const updatedOrganization = await prisma.organization.update({
    where: { id },
    data: { name },
  });

  revalidateOrganizationCache(id);

  return updatedOrganization;
}

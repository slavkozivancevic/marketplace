import { prisma } from "@/core/db/prisma";
import { MembershipRole, InviteStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import {
  revalidateOrganizationInvites,
  revalidateOrganizationMembers,
} from "./cache";
import { randomUUID } from "crypto";

export async function getInviteByToken(token: string) {
  return prisma.invite.findUnique({
    where: { token },
    include: { organization: true },
  });
}

export async function getPendingInvitesByOrg(orgId: string) {
  return prisma.invite.findMany({
    where: {
      orgId,
      status: InviteStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInvite({
  email,
  orgId,
  role,
  createdById,
}: {
  email: string;
  orgId: string;
  role: MembershipRole;
  createdById: string;
}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const existingPending = await prisma.invite.findFirst({
    where: {
      email,
      orgId,
      status: InviteStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingPending) {
    return existingPending;
  }

  const invite = await prisma.invite.create({
    data: {
      email,
      orgId,
      role,
      token: randomUUID(),
      expiresAt,
      createdById,
    },
  });

  revalidateOrganizationInvites(orgId);

  return invite;
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite) {
    throw new NotFoundError("Invite not found");
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new Error("Invite is no longer valid");
  }

  if (invite.expiresAt < new Date()) {
    throw new Error("Invite has expired");
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId,
        orgId: invite.orgId,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    if (existingMembership) {
      await tx.membership.update({
        where: { userId_orgId: { userId, orgId: invite.orgId } },
        data: { role: invite.role },
      });
    } else {
      await tx.membership.create({
        data: {
          userId,
          orgId: invite.orgId,
          role: invite.role,
        },
      });
    }

    await tx.invite.update({
      where: { token },
      data: { status: InviteStatus.ACCEPTED },
    });
  });

  revalidateOrganizationMembers(invite.orgId);
  revalidateOrganizationInvites(invite.orgId);

  return invite;
}

export async function cancelInvite(inviteId: string, orgId: string) {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.orgId !== orgId) {
    throw new NotFoundError("Invite not found");
  }

  await prisma.invite.update({
    where: { id: inviteId },
    data: { status: InviteStatus.CANCELED },
  });

  revalidateOrganizationInvites(orgId);
}

import { prisma } from "@/core/db/prisma";
import { MembershipRole, InviteStatus } from "@/generated/prisma/client";
import {
  NotFoundError,
  ForbiddenError,
  InviteInvalidError,
} from "@/features/common/errors/domainErrors";
import {
  revalidateOrganizationInvites,
  revalidateOrganizationMembers,
} from "./cache";
import { randomUUID } from "crypto";

// Invite emails are compared against Clerk-provided user emails, whose casing we
// don't control. Store and match everything lowercased+trimmed so "A@x.com" and
// "a@x.com" resolve to the same person.
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Privilege ordering used to guarantee invite acceptance never demotes an
// existing member (see acceptInvite). Higher = more privileged.
const ROLE_RANK: Record<MembershipRole, number> = {
  [MembershipRole.OWNER]: 3,
  [MembershipRole.ADMIN]: 2,
  [MembershipRole.MEMBER]: 1,
};

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
  const normalizedEmail = normalizeEmail(email);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Don't invite someone who already belongs to this org - the accept flow would
  // just reject them, so fail early with a clear message for the inviter.
  const existingMember = await prisma.membership.findFirst({
    where: {
      orgId,
      user: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        deletedAt: null,
      },
    },
  });

  if (existingMember) {
    throw new ForbiddenError({ key: "inviteAlreadyMember" });
  }

  const existingPending = await prisma.invite.findFirst({
    where: {
      email: normalizedEmail,
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
      email: normalizedEmail,
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

export async function acceptInvite(
  token: string,
  user: { id: string; email: string; name: string | null },
) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: true, createdBy: true },
  });

  if (!invite) {
    throw new NotFoundError("Invite not found");
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new InviteInvalidError({ key: "inviteNoLongerValid" });
  }

  if (invite.expiresAt < new Date()) {
    throw new InviteInvalidError({ key: "inviteExpired" });
  }

  // The invite link is a bearer token: without binding it to the invited email,
  // anyone who obtains the URL could join the org under a different account.
  // Compare case-insensitively since Clerk emails aren't normalized on our side.
  if (normalizeEmail(invite.email) !== normalizeEmail(user.email)) {
    throw new ForbiddenError({ key: "inviteEmailMismatch" });
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: invite.orgId,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    if (existingMembership) {
      // Never DOWNGRADE an existing member through invite acceptance. The classic
      // trap: an OWNER opens an invite (sent to someone else, or to their own
      // email at a lower role) and clicking Accept rewrites their role to the
      // invite's - silently demoting the owner and leaving the org with none.
      // Only apply the invited role when it's a strict promotion; otherwise the
      // accept is a no-op on their role. Role changes belong to the member-
      // management UI, not to invite acceptance.
      const shouldPromote =
        ROLE_RANK[invite.role] > ROLE_RANK[existingMembership.role];

      if (shouldPromote) {
        await tx.membership.update({
          where: { userId_orgId: { userId: user.id, orgId: invite.orgId } },
          data: { role: invite.role },
        });
      }
    } else {
      await tx.membership.create({
        data: {
          userId: user.id,
          orgId: invite.orgId,
          role: invite.role,
        },
      });
    }

    await tx.invite.update({
      where: { token },
      data: { status: InviteStatus.ACCEPTED },
    });

    // Land the member in the org they just joined so the dashboard they're
    // redirected to is scoped to it, not their personal org.
    await tx.user.update({
      where: { id: user.id },
      data: { activeOrgId: invite.orgId },
    });
  });

  revalidateOrganizationMembers(invite.orgId);
  revalidateOrganizationInvites(invite.orgId);

  return {
    orgId: invite.orgId,
    role: invite.role,
    organizationName: invite.organization.name,
    wasNewMember: !existingMembership,
    // createdBy is a required relation, so it's always present. It's the invite
    // notification's recipient (rendered in the inviter's own locale).
    inviter: {
      email: invite.createdBy.email,
      name: invite.createdBy.name,
      locale: invite.createdBy.locale,
    },
    member: { email: user.email, name: user.name },
  };
}

export async function declineInvite(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: true, createdBy: true },
  });

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  // Only a still-pending invite transitions to CANCELED (and notifies). Guards
  // against re-declining an already-final invite double-firing the email/audit.
  const wasPending = invite.status === InviteStatus.PENDING;

  if (wasPending) {
    await prisma.invite.update({
      where: { token },
      data: { status: InviteStatus.CANCELED },
    });

    revalidateOrganizationInvites(invite.orgId);
  }

  return {
    id: invite.id,
    orgId: invite.orgId,
    role: invite.role,
    organizationName: invite.organization.name,
    invitedEmail: invite.email,
    wasPending,
    inviter: {
      email: invite.createdBy.email,
      name: invite.createdBy.name,
      locale: invite.createdBy.locale,
    },
  };
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

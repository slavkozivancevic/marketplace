import { MembershipRole } from "@/generated/prisma/client";
import type { TransactionClient } from "@/core/db/prisma";

/**
 * Privilege ordering. Higher = more privileged. Used to guarantee invite
 * acceptance never demotes an existing member (acceptInvite), and to pick which
 * organization someone lands in when the one they were working in goes away.
 */
export const ROLE_RANK: Record<MembershipRole, number> = {
  [MembershipRole.OWNER]: 3,
  [MembershipRole.ADMIN]: 2,
  [MembershipRole.MEMBER]: 1,
};

/** The minimum a membership row has to carry to be ranked. */
export type ActiveOrgCandidate = {
  orgId: string;
  role: MembershipRole;
  createdAt: Date;
};

/**
 * Which organization a user is actually working in.
 *
 * `User.activeOrgId` is a bare column with no foreign key, and nothing stops it
 * from naming an org the user is no longer a member of - that is exactly what
 * happened when removing a member deleted the Membership row and left the
 * pointer behind. A dangling pointer used to read as "member of this org with
 * no permissions": every write was refused, the read-only banner claimed a
 * membership that did not exist, and the user's own products looked like
 * someone else's.
 *
 * So the stored id is a preference, never an authority: it counts only when a
 * membership backs it. Otherwise fall back by standing - your own business
 * (OWNER) before an org you help run (ADMIN) before one you merely belong to
 * (MEMBER) - and within one rank, the longest-tenured membership. Same
 * precedence `deleteUser` uses when it hands a sole owner's org to someone else.
 *
 * Returns null only when the user has no memberships at all: a plain buyer.
 */
export function pickActiveMembership<T extends ActiveOrgCandidate>(
  activeOrgId: string | null | undefined,
  memberships: readonly T[],
): T | null {
  const preferred = activeOrgId
    ? memberships.find((m) => m.orgId === activeOrgId)
    : undefined;

  if (preferred) return preferred;

  return (
    [...memberships].sort(
      (a, b) =>
        ROLE_RANK[b.role] - ROLE_RANK[a.role] ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )[0] ?? null
  );
}

/** Same choice as `pickActiveMembership`, as a plain id. */
export function pickActiveOrgId(
  activeOrgId: string | null | undefined,
  memberships: readonly ActiveOrgCandidate[],
): string | null {
  return pickActiveMembership(activeOrgId, memberships)?.orgId ?? null;
}

/**
 * Moves a user off an organization they just lost access to, in the same
 * transaction that took the access away - the two must never be separable, or
 * the user is left "active" in an org they are not a member of and the whole
 * dashboard turns read-only on them.
 *
 * A no-op when they were working in some other org. Returns the id they end up
 * on (null = no memberships left) so the caller can push it to Clerk, and
 * whether it changed at all.
 */
export async function reassignActiveOrg(
  tx: TransactionClient,
  userId: string,
  lostOrgId: string,
): Promise<{ changed: boolean; activeOrgId: string | null }> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { activeOrgId: true },
  });

  if (!user || user.activeOrgId !== lostOrgId) {
    return { changed: false, activeOrgId: user?.activeOrgId ?? null };
  }

  const remaining = await tx.membership.findMany({
    where: { userId },
    select: { orgId: true, role: true, createdAt: true },
  });

  // `activeOrgId` is deliberately not passed: the org it names is the one being
  // left, so it must not win the preference check.
  const activeOrgId = pickActiveOrgId(null, remaining);

  await tx.user.update({
    where: { id: userId },
    data: { activeOrgId },
  });

  return { changed: true, activeOrgId };
}

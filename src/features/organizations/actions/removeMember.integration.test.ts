import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
} from "../../../../test/integration/helpers";

// Who is clicking Remove right now. Set per test, because whether the actor is
// left out of the fan-out is one of the things under test here.
const { actor } = vi.hoisted(() => ({
  actor: { userId: "", organizationId: "", membershipRole: "OWNER" as string },
}));

vi.mock("@/lib/auth/resolveRequestContext", () => ({
  resolveRequestContext: vi.fn(async () => ({
    userId: actor.userId,
    organizationId: actor.organizationId,
    membershipRole: actor.membershipRole,
    isPlatformAdmin: false,
  })),
}));

// Cache invalidation and the audit write need a Server Action context that does
// not exist under the test runner; the membership row and the fan-out are the
// point here.
vi.mock("@/features/organizations/db/cache", () => ({
  revalidateOrganizationCache: vi.fn(),
  revalidateOrganizationMembers: vi.fn(),
}));
vi.mock("@/features/users/db/cache", () => ({ revalidateUserCache: vi.fn() }));
// A refused removal goes through handleActionError -> getTranslations, and
// next-intl resolves to its react-client build under the runner ("not supported
// in Client Components"). The message text is not what these tests are about,
// so the lookup is stubbed with the key itself.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/services/clerk", () => ({ syncClerkUserMetadata: vi.fn() }));
vi.mock("@/features/audit/db/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/notifications", () => ({
  publishMemberAccessRevoked: vi.fn().mockResolvedValue(undefined),
  publishMemberRemoved: vi.fn().mockResolvedValue(undefined),
  publishMemberRoleChanged: vi.fn().mockResolvedValue(undefined),
}));

const { removeMemberAction } = await import("./organizations");
const { publishMemberAccessRevoked, publishMemberRemoved } = await import(
  "@/services/notifications"
);
const { syncClerkUserMetadata } = await import("@/services/clerk");

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function member(orgId: string, role: "OWNER" | "ADMIN" | "MEMBER", locale?: string) {
  const user = await createUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { name: `${role} ${user.id.slice(0, 4)}`, ...(locale ? { locale } : {}) },
  });
  await prisma.membership.create({ data: { userId: user.id, orgId, role } });
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

/** An org with an owner who is doing the removing, and a member to remove. */
async function orgWithActor() {
  const org = await createOrganization();
  const owner = await member(org.id, "OWNER");
  const target = await member(org.id, "MEMBER", "sr");
  actor.userId = owner.id;
  actor.organizationId = org.id;
  actor.membershipRole = "OWNER";
  return { org, owner, target };
}

describe("removeMemberAction", () => {
  it("removes the membership and tells the member, in their own language", async () => {
    const { org, target } = await orgWithActor();

    await removeMemberAction(target.id);

    expect(
      await prisma.membership.findUnique({
        where: { userId_orgId: { userId: target.id, orgId: org.id } },
      }),
    ).toBeNull();

    expect(publishMemberAccessRevoked).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: target.email,
        organizationName: org.name,
        removedRole: "MEMBER",
        locale: "sr",
      }),
    );
  });

  it("tells the org's other owners and admins, each in their own language", async () => {
    const { org, target } = await orgWithActor();
    const coOwner = await member(org.id, "OWNER", "de");
    const admin = await member(org.id, "ADMIN", "es");

    await removeMemberAction(target.id);

    const byRecipient = new Map(
      vi.mocked(publishMemberRemoved).mock.calls.map(([args]) => [args.recipientEmail, args]),
    );
    expect(byRecipient.get(coOwner.email)).toMatchObject({
      locale: "de",
      reason: "removed_by_admin",
      removedUserEmail: target.email,
      removedRole: "MEMBER",
    });
    expect(byRecipient.get(admin.email)?.locale).toBe("es");
  });

  it("leaves the acting admin out - they just clicked the button", async () => {
    const { org, owner, target } = await orgWithActor();
    await member(org.id, "ADMIN");

    await removeMemberAction(target.id);

    const recipients = vi
      .mocked(publishMemberRemoved)
      .mock.calls.map(([args]) => args.recipientEmail);
    expect(recipients).not.toContain(owner.email);
    expect(recipients).toHaveLength(1);
  });

  it("does not notify plain members, who cannot see the member list anyway", async () => {
    const { org, target } = await orgWithActor();
    const bystander = await member(org.id, "MEMBER");

    await removeMemberAction(target.id);

    const recipients = vi
      .mocked(publishMemberRemoved)
      .mock.calls.map(([args]) => args.recipientEmail);
    expect(recipients).not.toContain(bystander.email);
    expect(recipients).toEqual([]);
  });

  it("notifies nobody when the removal is refused", async () => {
    const org = await createOrganization();
    const owner = await member(org.id, "OWNER");
    const otherOwner = await member(org.id, "OWNER");
    actor.userId = owner.id;
    actor.organizationId = org.id;
    actor.membershipRole = "OWNER";

    // An owner cannot be removed - removeMember throws before anything is sent.
    const result = await removeMemberAction(otherOwner.id);

    expect(result).toMatchObject({ error: true });
    expect(
      await prisma.membership.findUnique({
        where: { userId_orgId: { userId: otherOwner.id, orgId: org.id } },
      }),
    ).not.toBeNull();
    expect(publishMemberAccessRevoked).not.toHaveBeenCalled();
    expect(publishMemberRemoved).not.toHaveBeenCalled();
  });
});

/**
 * Losing a membership used to leave `User.activeOrgId` pointing at the org the
 * member had just been thrown out of. The column has no foreign key, so nothing
 * caught it: the seller stayed "active" in an org she was not in, every page
 * that reads the column found no membership behind it, and the owner of her own
 * shop was shown a read-only banner she could not clear.
 */
describe("removeMemberAction - where the removed member lands", () => {
  async function activeIn(userId: string, orgId: string | null) {
    await prisma.user.update({ where: { id: userId }, data: { activeOrgId: orgId } });
  }

  it("moves a member who was working here onto their own organization", async () => {
    const { org, target } = await orgWithActor();
    const ownOrg = await createOrganization();
    await prisma.membership.create({
      data: { userId: target.id, orgId: ownOrg.id, role: "OWNER" },
    });
    await activeIn(target.id, org.id);

    await removeMemberAction(target.id);

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).activeOrgId,
    ).toBe(ownOrg.id);

    // Their live session still carries the old org in its JWT claim, so the
    // move has to reach Clerk too, not just the database.
    expect(syncClerkUserMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: target.clerkUserId,
        activeOrgId: ownOrg.id,
      }),
    );
  });

  it("prefers the org they own over one they merely belong to", async () => {
    const { org, target } = await orgWithActor();
    const ownOrg = await createOrganization();
    const guestOrg = await createOrganization();
    await prisma.membership.create({
      data: { userId: target.id, orgId: guestOrg.id, role: "MEMBER" },
    });
    await prisma.membership.create({
      data: { userId: target.id, orgId: ownOrg.id, role: "OWNER" },
    });
    await activeIn(target.id, org.id);

    await removeMemberAction(target.id);

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).activeOrgId,
    ).toBe(ownOrg.id);
  });

  it("leaves the active org alone when they were working somewhere else", async () => {
    const { target } = await orgWithActor();
    const ownOrg = await createOrganization();
    await prisma.membership.create({
      data: { userId: target.id, orgId: ownOrg.id, role: "OWNER" },
    });
    await activeIn(target.id, ownOrg.id);

    await removeMemberAction(target.id);

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).activeOrgId,
    ).toBe(ownOrg.id);
    // Nothing moved, so no Clerk write - those are rate-limited.
    expect(syncClerkUserMetadata).not.toHaveBeenCalled();
  });

  it("clears the active org when that was their last membership", async () => {
    const { org, target } = await orgWithActor();
    await activeIn(target.id, org.id);

    await removeMemberAction(target.id);

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).activeOrgId,
    ).toBeNull();
    expect(syncClerkUserMetadata).not.toHaveBeenCalled();
  });

  it("keeps the membership and the pointer when the removal is refused", async () => {
    const org = await createOrganization();
    const owner = await member(org.id, "OWNER");
    const otherOwner = await member(org.id, "OWNER");
    await activeIn(otherOwner.id, org.id);
    actor.userId = owner.id;
    actor.organizationId = org.id;
    actor.membershipRole = "OWNER";

    await removeMemberAction(otherOwner.id);

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: otherOwner.id } })).activeOrgId,
    ).toBe(org.id);
  });
});

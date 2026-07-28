import { describe, it, expect, beforeEach, vi } from "vitest";
import { deleteUser } from "./users";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

// deleteUser fires best-effort SNS notifications (owner auto-promoted, member
// removed); stub the boundary so assertions stay deterministic and offline
// (no real AWS SSM/SNS call).
const publishOwnerAutoPromoted = vi.fn().mockResolvedValue(undefined);
const publishMemberRemoved = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/notifications", () => ({
  publishOwnerAutoPromoted: (...args: unknown[]) => publishOwnerAutoPromoted(...args),
  publishMemberRemoved: (...args: unknown[]) => publishMemberRemoved(...args),
}));

beforeEach(async () => {
  await resetDb();
  publishMemberRemoved.mockClear();
  publishOwnerAutoPromoted.mockClear();
});

describe("deleteUser", () => {
  it("hard-deletes an empty org when its sole owner is removed", async () => {
    const user = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: "OWNER" },
    });

    await deleteUser(user.clerkUserId);

    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
    const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(deletedUser?.deletedAt).not.toBeNull();
  });

  it("keeps the org and soft-deletes its products when its sole owner (with a live catalog) is removed", async () => {
    const user = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: "OWNER" },
    });
    const product = await createProduct({ organizationId: org.id });

    await deleteUser(user.clerkUserId);

    // Organization.id is ON DELETE RESTRICT from Product - a hard delete here
    // would throw and roll back the whole call, leaving the user un-deleted.
    const survivingOrg = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(survivingOrg).not.toBeNull();

    const deletedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(deletedProduct?.deletedAt).not.toBeNull();

    expect(await prisma.membership.count({ where: { orgId: org.id } })).toBe(0);

    const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(deletedUser?.deletedAt).not.toBeNull();
  });

  it("only removes membership when the org has another owner, and notifies the remaining owner", async () => {
    const user = await createUser();
    const otherOwner = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: "OWNER" },
    });
    await prisma.membership.create({
      data: { userId: otherOwner.id, orgId: org.id, role: "OWNER" },
    });

    await deleteUser(user.clerkUserId);

    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
    expect(
      await prisma.membership.findUnique({
        where: { userId_orgId: { userId: otherOwner.id, orgId: org.id } },
      }),
    ).not.toBeNull();

    expect(publishMemberRemoved).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: otherOwner.email,
        organizationName: org.name,
        removedUserEmail: user.email,
        removedRole: "OWNER",
      }),
    );
    const auditRow = await prisma.auditLog.findFirst({
      where: { action: "organization.member_removed", entityId: org.id },
    });
    expect(auditRow).not.toBeNull();
  });

  it("notifies remaining OWNER/ADMIN (not plain MEMBERs) when a non-owner member is removed", async () => {
    const owner = await createUser();
    const otherAdmin = await createUser();
    const plainMember = await createUser();
    const departingMember = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.membership.create({ data: { userId: otherAdmin.id, orgId: org.id, role: "ADMIN" } });
    await prisma.membership.create({ data: { userId: plainMember.id, orgId: org.id, role: "MEMBER" } });
    await prisma.membership.create({ data: { userId: departingMember.id, orgId: org.id, role: "MEMBER" } });

    await deleteUser(departingMember.clerkUserId);

    // Membership gone, org and everyone else untouched.
    expect(
      await prisma.membership.findUnique({
        where: { userId_orgId: { userId: departingMember.id, orgId: org.id } },
      }),
    ).toBeNull();
    expect(await prisma.membership.count({ where: { orgId: org.id } })).toBe(3);

    // Owner and admin notified, plain member is not a recipient.
    const recipientEmails = publishMemberRemoved.mock.calls.map((c) => c[0].recipientEmail);
    expect(recipientEmails.sort()).toEqual([owner.email, otherAdmin.email].sort());
    expect(recipientEmails).not.toContain(plainMember.email);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: "organization.member_removed", entityId: org.id },
    });
    expect(auditRow).not.toBeNull();
    expect((auditRow?.diff as { role?: string } | null)?.role).toBe("MEMBER");
  });

  it("auto-promotes the ADMIN over a MEMBER when the sole owner is removed and staff remain", async () => {
    const owner = await createUser();
    const admin = await createUser();
    const member = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.membership.create({ data: { userId: member.id, orgId: org.id, role: "MEMBER" } });
    await prisma.membership.create({ data: { userId: admin.id, orgId: org.id, role: "ADMIN" } });
    const product = await createProduct({ organizationId: org.id });

    await deleteUser(owner.clerkUserId);

    // Business keeps running: org survives, catalog untouched.
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
    const untouchedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(untouchedProduct?.deletedAt).toBeNull();

    // The ADMIN (not the MEMBER) is promoted to OWNER.
    const adminMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    });
    expect(adminMembership?.role).toBe("OWNER");
    const memberMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: member.id, orgId: org.id } },
    });
    expect(memberMembership?.role).toBe("MEMBER");

    // The departed owner's own membership is gone.
    expect(
      await prisma.membership.findUnique({
        where: { userId_orgId: { userId: owner.id, orgId: org.id } },
      }),
    ).toBeNull();

    // Notified and audited.
    expect(publishOwnerAutoPromoted).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: admin.email, organizationName: org.name }),
    );
    const auditRow = await prisma.auditLog.findFirst({
      where: { action: "organization.owner_promoted", entityId: org.id },
    });
    expect(auditRow).not.toBeNull();
  });

  it("promotes the longer-tenured member when two members share the same role", async () => {
    const owner = await createUser();
    const olderAdmin = await createUser();
    const newerAdmin = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.membership.create({
      data: { userId: newerAdmin.id, orgId: org.id, role: "ADMIN", createdAt: new Date("2024-06-01") },
    });
    await prisma.membership.create({
      data: { userId: olderAdmin.id, orgId: org.id, role: "ADMIN", createdAt: new Date("2020-01-01") },
    });

    await deleteUser(owner.clerkUserId);

    const olderMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: olderAdmin.id, orgId: org.id } },
    });
    expect(olderMembership?.role).toBe("OWNER");
    const newerMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: newerAdmin.id, orgId: org.id } },
    });
    expect(newerMembership?.role).toBe("ADMIN");
  });

  it("still deactivates the catalog when the sole owner has no ADMIN/MEMBER staff to promote", async () => {
    const owner = await createUser();
    const org = await createOrganization();
    await prisma.membership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    const product = await createProduct({ organizationId: org.id });

    await deleteUser(owner.clerkUserId);

    const survivingOrg = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(survivingOrg).not.toBeNull();
    const deletedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(deletedProduct?.deletedAt).not.toBeNull();
    expect(publishOwnerAutoPromoted).not.toHaveBeenCalled();

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: "organization.catalog_deactivated", entityId: org.id },
    });
    expect(auditRow).not.toBeNull();
  });
});

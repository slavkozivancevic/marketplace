import { describe, it, expect } from "vitest";
import { MembershipRole, UserRole } from "@/generated/prisma/client";
import { requirePermission, canManageOrgPayouts, assertWritable } from "./permissions";
import {
  DemoReadOnlyError,
  ForbiddenError,
  OrganizationNotVerifiedError,
} from "@/features/common/errors/domainErrors";
import type { RequestContext } from "@/types/types";

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    clerkUserId: "clerk_1",
    userId: "user_1",
    userRole: UserRole.USER,
    organizationId: "org_1",
    membershipRole: MembershipRole.OWNER,
    organizationVerified: true,
    isDemoReadOnly: false,
    ...overrides,
  };
}

describe("canManageOrgPayouts", () => {
  it("allows OWNER and ADMIN", () => {
    expect(canManageOrgPayouts(MembershipRole.OWNER)).toBe(true);
    expect(canManageOrgPayouts(MembershipRole.ADMIN)).toBe(true);
  });

  it("denies MEMBER", () => {
    expect(canManageOrgPayouts(MembershipRole.MEMBER)).toBe(false);
  });
});

describe("requirePermission", () => {
  it("passes for a role that holds the permission", () => {
    expect(() =>
      requirePermission(makeCtx({ membershipRole: MembershipRole.OWNER }), "product:create"),
    ).not.toThrow();
  });

  it("throws ForbiddenError when the role lacks the permission", () => {
    expect(() =>
      requirePermission(makeCtx({ membershipRole: MembershipRole.MEMBER }), "product:create"),
    ).toThrow(ForbiddenError);
  });

  it("allows a read permission for a MEMBER", () => {
    expect(() =>
      requirePermission(makeCtx({ membershipRole: MembershipRole.MEMBER }), "product:read"),
    ).not.toThrow();
  });

  it("requires a verified org for write permissions", () => {
    expect(() =>
      requirePermission(
        makeCtx({ membershipRole: MembershipRole.OWNER, organizationVerified: false }),
        "product:create",
      ),
    ).toThrow(OrganizationNotVerifiedError);
  });

  it("does not require verification for read permissions", () => {
    expect(() =>
      requirePermission(
        makeCtx({ membershipRole: MembershipRole.MEMBER, organizationVerified: false }),
        "product:read",
      ),
    ).not.toThrow();
  });

  it("lets a site ADMIN bypass the membership-role check", () => {
    expect(() =>
      requirePermission(
        makeCtx({ userRole: UserRole.ADMIN, membershipRole: MembershipRole.MEMBER }),
        "product:create",
      ),
    ).not.toThrow();
  });

  it("lets a site ADMIN bypass the verification gate too", () => {
    expect(() =>
      requirePermission(
        makeCtx({
          userRole: UserRole.ADMIN,
          membershipRole: MembershipRole.MEMBER,
          organizationVerified: false,
        }),
        "product:create",
      ),
    ).not.toThrow();
  });
});

describe("view-only demo accounts", () => {
  it("refuses every write, before the platform-admin bypass", () => {
    const demoAdmin = makeCtx({ userRole: UserRole.ADMIN, isDemoReadOnly: true });
    for (const permission of ["product:create", "product:update", "product:delete", "order:manage", "payout:manage"] as const) {
      expect(() => requirePermission(demoAdmin, permission)).toThrow(DemoReadOnlyError);
    }
  });

  it("still lets them read", () => {
    const demoSeller = makeCtx({ membershipRole: MembershipRole.ADMIN, isDemoReadOnly: true });
    expect(() => requirePermission(demoSeller, "product:read")).not.toThrow();
    expect(() => requirePermission(demoSeller, "order:read")).not.toThrow();
  });

  it("assertWritable passes everyone else", () => {
    expect(() => assertWritable(makeCtx())).not.toThrow();
    expect(() => assertWritable(makeCtx({ isDemoReadOnly: true }))).toThrow(DemoReadOnlyError);
  });
});

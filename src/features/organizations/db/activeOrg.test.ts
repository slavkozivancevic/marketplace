import { describe, it, expect } from "vitest";
import { MembershipRole } from "@/generated/prisma/client";
import { pickActiveMembership, pickActiveOrgId } from "./activeOrg";

const day = (n: number) => new Date(2026, 0, n);

const m = (orgId: string, role: MembershipRole, createdAt: Date) => ({
  orgId,
  role,
  createdAt,
});

describe("pickActiveMembership", () => {
  it("honours the stored active org when a membership backs it", () => {
    const memberships = [
      m("own", MembershipRole.OWNER, day(1)),
      m("guest", MembershipRole.MEMBER, day(2)),
    ];

    expect(pickActiveMembership("guest", memberships)?.orgId).toBe("guest");
  });

  it("falls back to the user's own org when the stored one is not a membership", () => {
    // The regression this whole module exists for: the membership row was
    // deleted, the column kept pointing at the org, and the seller was shown
    // her own shop as read-only.
    const memberships = [m("own", MembershipRole.OWNER, day(1))];

    expect(pickActiveMembership("removed-from-this-one", memberships)?.orgId).toBe(
      "own",
    );
  });

  it("prefers OWNER over ADMIN over MEMBER, regardless of order", () => {
    const memberships = [
      m("guest", MembershipRole.MEMBER, day(1)),
      m("own", MembershipRole.OWNER, day(3)),
      m("helping", MembershipRole.ADMIN, day(2)),
    ];

    expect(pickActiveOrgId(null, memberships)).toBe("own");
    expect(
      pickActiveOrgId(null, [
        m("guest", MembershipRole.MEMBER, day(1)),
        m("helping", MembershipRole.ADMIN, day(2)),
      ]),
    ).toBe("helping");
  });

  it("breaks a tie within one rank by the longest-tenured membership", () => {
    const memberships = [
      m("newer", MembershipRole.OWNER, day(5)),
      m("older", MembershipRole.OWNER, day(2)),
    ];

    expect(pickActiveOrgId(null, memberships)).toBe("older");
  });

  it("does not mutate the caller's array", () => {
    const memberships = [
      m("guest", MembershipRole.MEMBER, day(1)),
      m("own", MembershipRole.OWNER, day(2)),
    ];

    pickActiveOrgId(null, memberships);

    expect(memberships.map((x) => x.orgId)).toEqual(["guest", "own"]);
  });

  it("returns null for a user with no memberships - a plain buyer", () => {
    expect(pickActiveMembership("stale", [])).toBeNull();
    expect(pickActiveOrgId(null, [])).toBeNull();
  });
});

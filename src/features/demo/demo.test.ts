import { describe, it, expect } from "vitest";
import {
  DEMO_ACCOUNTS,
  demoRoleOfEmail,
  isDemoReadOnlyEmail,
  isDemoRole,
} from "./demoAccounts";
import { demoSafe, maskEmail, maskEmails } from "./maskEmail";
import { demoLandingPath, demoTicketUrl } from "./demoSignIn";

describe("demo accounts", () => {
  it("lets only the buyer write", () => {
    expect(DEMO_ACCOUNTS.buyer.readOnly).toBe(false);
    expect(DEMO_ACCOUNTS.seller.readOnly).toBe(true);
    expect(DEMO_ACCOUNTS.admin.readOnly).toBe(true);
  });

  it("recognises a demo email regardless of case and whitespace", () => {
    expect(demoRoleOfEmail(` ${DEMO_ACCOUNTS.seller.email.toUpperCase()} `)).toBe("seller");
    expect(isDemoReadOnlyEmail(DEMO_ACCOUNTS.admin.email)).toBe(true);
    expect(isDemoReadOnlyEmail(DEMO_ACCOUNTS.buyer.email)).toBe(false);
  });

  it("treats every other address, and none, as a real user", () => {
    expect(demoRoleOfEmail("slavko.zivancevic@protonmail.com")).toBeNull();
    expect(isDemoReadOnlyEmail(null)).toBe(false);
    expect(isDemoReadOnlyEmail(undefined)).toBe(false);
  });

  it("accepts only the three roles from a query string", () => {
    expect(isDemoRole("seller")).toBe(true);
    expect(isDemoRole("owner")).toBe(false);
    expect(isDemoRole(null)).toBe(false);
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("marija@example.com")).toBe("m***@example.com");
  });

  it("hides a value that is not an address at all", () => {
    expect(maskEmail("@example.com")).toBe("***");
    expect(maskEmail("nobody")).toBe("***");
  });

  it("masks email and actorEmail at any depth, and nothing else", () => {
    const createdAt = new Date("2026-10-01T00:00:00Z");
    const input = {
      name: "Marija",
      email: "marija@example.com",
      createdAt,
      members: [{ user: { name: "Toma", email: "toma@example.com" } }],
      log: [{ actorEmail: "admin@example.com", diff: { email: { from: "a@x.io", to: "b@x.io" } } }],
    };
    const out = maskEmails(input);
    expect(out.name).toBe("Marija");
    expect(out.email).toBe("m***@example.com");
    expect(out.createdAt).toBe(createdAt);
    expect(out.members[0].user.email).toBe("t***@example.com");
    expect(out.log[0].actorEmail).toBe("a***@example.com");
    // A diff's email field is an object, not an address: walked, not replaced.
    expect(out.log[0].diff.email).toEqual({ from: "a@x.io", to: "b@x.io" });
    expect(input.email).toBe("marija@example.com");
  });

  it("changes nothing for a viewer who is not a demo account", () => {
    const rows = [{ email: "marija@example.com" }];
    expect(demoSafe(rows, { isDemoReadOnly: false })).toBe(rows);
    expect(demoSafe(rows, { isDemoReadOnly: true })[0].email).toBe("m***@example.com");
  });
});

describe("demo sign-in URLs", () => {
  it("lands each role on its own localized home", () => {
    expect(demoLandingPath("buyer", "sr")).toBe("/sr/proizvodi");
    expect(demoLandingPath("seller", "en")).toBe("/en/dashboard");
    expect(demoLandingPath("admin", "de")).toBe("/de/admin");
  });

  it("sends the ticket to the locale's sign-in page with an absolute redirect", () => {
    const url = demoTicketUrl("https://marketverseapp.com", "buyer", "es", "tok_123");
    expect(url.origin + url.pathname).toBe("https://marketverseapp.com/es/sign-in");
    expect(url.searchParams.get("__clerk_ticket")).toBe("tok_123");
    expect(url.searchParams.get("redirect_url")).toBe("https://marketverseapp.com/es/productos");
  });
});

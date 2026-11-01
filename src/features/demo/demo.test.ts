import { describe, it, expect, vi } from "vitest";
import {
  DEMO_ACCOUNTS,
  demoRoleOfEmail,
  isDemoReadOnlyEmail,
  isDemoRole,
  isVisitorBuyerEmail,
  newDemoBuyerIdentity,
  syncedEmail,
} from "./demoAccounts";
import {
  DEMO_BUYER_CLEANUP_BATCH,
  DEMO_BUYER_LIMIT,
  DEMO_BUYER_TTL_MS,
  pickDemoBuyersToRetire,
} from "./demoBuyerPolicy";
import { demoSafe, maskEmail, maskEmails } from "./maskEmail";
import { DEMO_BUSY_PARAM, demoBusyUrl, demoLandingPath, demoTicketUrl } from "./demoSignIn";
import { repairDemoAccount, type DemoRepairClerk } from "./repairDemoAccount";

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
  it("sends a rate-limited click back to sign-in with whole seconds to wait", () => {
    const url = demoBusyUrl("https://marketverseapp.com", "sr", 61.2);
    expect(url.pathname).toBe("/sr/sign-in");
    expect(url.searchParams.get(DEMO_BUSY_PARAM)).toBe("62");
    expect(demoBusyUrl("https://marketverseapp.com", "en", 0).searchParams.get(DEMO_BUSY_PARAM)).toBe("1");
  });

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

describe("syncedEmail", () => {
  const seller = DEMO_ACCOUNTS.seller.email;

  it("keeps a demo account's address whatever Clerk now calls primary", () => {
    expect(syncedEmail(seller, "visitor@gmail.com")).toBe(seller);
  });

  it("lets everyone else follow Clerk", () => {
    expect(syncedEmail("old@example.com", "new@example.com")).toBe("new@example.com");
  });

  it("takes Clerk's address for a row that does not exist yet", () => {
    expect(syncedEmail(null, seller)).toBe(seller);
    expect(syncedEmail(undefined, "new@example.com")).toBe("new@example.com");
  });
});

describe("repairDemoAccount", () => {
  const account = DEMO_ACCOUNTS.seller;

  type FakeUser = {
    firstName: string;
    lastName: string;
    hasImage: boolean;
    twoFactorEnabled: boolean;
    externalAccounts: { id: string }[];
    emailAddresses: { id: string; emailAddress: string }[];
    primaryEmailAddressId: string;
  };

  const clean = (): FakeUser => ({
    firstName: account.firstName,
    lastName: account.lastName,
    hasImage: false,
    twoFactorEnabled: false,
    externalAccounts: [],
    emailAddresses: [{ id: "idn_alias", emailAddress: account.email }],
    primaryEmailAddressId: "idn_alias",
  });

  function fakeClerk(...reads: FakeUser[]) {
    const ok = () => Promise.resolve({});
    const getUser = vi.fn();
    for (const user of reads) getUser.mockResolvedValueOnce(user);
    const clerk = {
      users: {
        getUser,
        updateUser: vi.fn(ok),
        deleteUserExternalAccount: vi.fn(ok),
        disableUserMFA: vi.fn(ok),
        deleteUserProfileImage: vi.fn(ok),
      },
      emailAddresses: {
        createEmailAddress: vi.fn(ok),
        updateEmailAddress: vi.fn(ok),
        deleteEmailAddress: vi.fn(ok),
      },
    };
    const writes = () =>
      [...Object.entries(clerk.users), ...Object.entries(clerk.emailAddresses)]
        .filter(([name, fn]) => name !== "getUser" && fn.mock.calls.length > 0)
        .map(([name]) => name);
    return { clerk, client: clerk as unknown as DemoRepairClerk, writes };
  }

  it("costs one read and no writes when nothing drifted", async () => {
    const { clerk, client, writes } = fakeClerk(clean());
    await repairDemoAccount(client, "user_1", account);
    expect(clerk.users.getUser).toHaveBeenCalledTimes(1);
    expect(writes()).toEqual([]);
  });

  it("undoes a visitor's address made primary through a connected Google account", async () => {
    const dirty: FakeUser = {
      ...clean(),
      firstName: "Hacked",
      hasImage: true,
      twoFactorEnabled: true,
      externalAccounts: [{ id: "eac_google" }],
      emailAddresses: [
        { id: "idn_alias", emailAddress: account.email },
        { id: "idn_google", emailAddress: "visitor@gmail.com" },
        { id: "idn_extra", emailAddress: "other@example.com" },
      ],
      primaryEmailAddressId: "idn_google",
    };
    // Deleting the Google account took its address with it.
    const afterExternal: FakeUser = {
      ...dirty,
      externalAccounts: [],
      emailAddresses: dirty.emailAddresses.filter((e) => e.id !== "idn_google"),
      primaryEmailAddressId: "idn_extra",
    };
    const { clerk, client } = fakeClerk(dirty, afterExternal);
    await repairDemoAccount(client, "user_1", account);

    expect(clerk.users.updateUser).toHaveBeenCalledWith("user_1", {
      firstName: account.firstName,
      lastName: account.lastName,
    });
    expect(clerk.users.deleteUserProfileImage).toHaveBeenCalledWith("user_1");
    expect(clerk.users.disableUserMFA).toHaveBeenCalledWith("user_1");
    expect(clerk.users.deleteUserExternalAccount).toHaveBeenCalledWith({
      userId: "user_1",
      externalAccountId: "eac_google",
    });
    expect(clerk.emailAddresses.updateEmailAddress).toHaveBeenCalledWith("idn_alias", { primary: true });
    expect(clerk.emailAddresses.deleteEmailAddress.mock.calls).toEqual([["idn_extra"]]);
    // The alias is primary before anything is deleted - Clerk refuses to delete a primary.
    expect(clerk.emailAddresses.updateEmailAddress.mock.invocationCallOrder[0]).toBeLessThan(
      clerk.emailAddresses.deleteEmailAddress.mock.invocationCallOrder[0],
    );
  });

  it("puts the alias back when a visitor removed it", async () => {
    const { clerk, client } = fakeClerk({
      ...clean(),
      emailAddresses: [{ id: "idn_visitor", emailAddress: "visitor@example.com" }],
      primaryEmailAddressId: "idn_visitor",
    });
    await repairDemoAccount(client, "user_1", account);
    expect(clerk.emailAddresses.createEmailAddress).toHaveBeenCalledWith({
      userId: "user_1",
      emailAddress: account.email,
      verified: true,
      primary: true,
    });
    expect(clerk.emailAddresses.deleteEmailAddress.mock.calls).toEqual([["idn_visitor"]]);
  });
});

describe("visitor buyers", () => {
  it("gives each visitor a fresh alias of the buyer's address, recognised as the buyer", () => {
    const a = newDemoBuyerIdentity();
    const b = newDemoBuyerIdentity();
    expect(a.email).not.toBe(b.email);
    expect(a.email).toBe(`slavko.zivancevic+demo-buyer-${a.code}@protonmail.com`);
    expect(a.code).toMatch(/^[a-z0-9]{6}$/);
    expect(isVisitorBuyerEmail(a.email)).toBe(true);
    expect(demoRoleOfEmail(a.email.toUpperCase())).toBe("buyer");
    expect(isDemoReadOnlyEmail(a.email)).toBe(false);
    expect(syncedEmail(a.email, "visitor@gmail.com")).toBe(a.email);
  });

  it("does not mistake the shared buyer or a look-alike for a visitor buyer", () => {
    expect(isVisitorBuyerEmail(DEMO_ACCOUNTS.buyer.email)).toBe(false);
    expect(isVisitorBuyerEmail("slavko.zivancevic+demo-buyer-abc12@protonmail.com")).toBe(false);
    expect(isVisitorBuyerEmail("slavko.zivancevic+demo-buyer-abc123@protonmail.com.evil.com")).toBe(false);
    expect(isVisitorBuyerEmail("slavkoXzivancevic+demo-buyer-abc123@protonmail.com")).toBe(false);
    expect(demoRoleOfEmail("x+demo-buyer-abc123@protonmail.com")).toBeNull();
  });
});

describe("pickDemoBuyersToRetire", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const hour = 60 * 60 * 1000;
  const row = (id: string, age: number) => ({ clerkUserId: id, createdAt: ago(age) });

  it("retires buyers past a day, oldest first, and keeps the rest", () => {
    const rows = [row("fresh", hour), row("old", DEMO_BUYER_TTL_MS + hour), row("older", 3 * DEMO_BUYER_TTL_MS)];
    expect(pickDemoBuyersToRetire(rows, now)).toEqual(["older", "old"]);
  });

  it("retires nothing while every buyer is young and there is room", () => {
    expect(pickDemoBuyersToRetire([row("a", hour), row("b", 2 * hour)], now)).toEqual([]);
  });

  it("makes room under the limit by retiring the oldest young ones", () => {
    const rows = Array.from({ length: DEMO_BUYER_LIMIT }, (_, i) => row(`b${i}`, (i + 1) * 60_000));
    // A full house: one has to go so the new one fits - the oldest.
    expect(pickDemoBuyersToRetire(rows, now)).toEqual([`b${DEMO_BUYER_LIMIT - 1}`]);
  });

  it("retires at most one batch per click", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`x${i}`, DEMO_BUYER_TTL_MS + i * hour));
    expect(pickDemoBuyersToRetire(rows, now)).toHaveLength(DEMO_BUYER_CLEANUP_BATCH);
  });
});

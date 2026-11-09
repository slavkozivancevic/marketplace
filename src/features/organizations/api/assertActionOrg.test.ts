import { describe, it, expect, vi, beforeEach } from "vitest";

let requestHeaders = new Headers();
const refresh = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));

const { assertActionOrg } = await import("./assertActionOrg");
const { OrgChangedActionError } = await import("@/features/common/errors/domainErrors");

const ctx = { organizationId: "org_b" };

describe("assertActionOrg", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("lets a page render through: no Server Action header", async () => {
    requestHeaders = new Headers({ "x-active-org": "org_a" });
    await expect(assertActionOrg(ctx)).resolves.toBeUndefined();
  });

  it("lets an action through when the tab sends no org (storefront, admin, a page from before a deploy)", async () => {
    requestHeaders = new Headers({ "next-action": "abc" });
    await expect(assertActionOrg(ctx)).resolves.toBeUndefined();
  });

  it("lets an action through from a tab showing the org it resolves to", async () => {
    requestHeaders = new Headers({ "next-action": "abc", "x-active-org": "org_b" });
    await expect(assertActionOrg(ctx)).resolves.toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses a save from a tab still showing another org, and re-renders that tab", async () => {
    requestHeaders = new Headers({ "next-action": "abc", "x-active-org": "org_a" });
    await expect(assertActionOrg(ctx)).rejects.toBeInstanceOf(OrgChangedActionError);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

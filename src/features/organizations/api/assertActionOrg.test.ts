import { describe, it, expect, vi, beforeEach } from "vitest";

let requestHeaders = new Headers();
let phase: "action" | "render" | "after" | undefined = "action";
const refresh = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("next/dist/server/app-render/work-unit-async-storage.external", () => ({
  workUnitAsyncStorage: { getStore: () => (phase ? { phase } : undefined) },
}));

const { assertActionOrg } = await import("./assertActionOrg");
const { OrgChangedActionError } = await import("@/features/common/errors/domainErrors");

const ctx = { organizationId: "org_b" };
const stale = () => new Headers({ "next-action": "abc", "x-active-org": "org_a" });

describe("assertActionOrg", () => {
  beforeEach(() => {
    refresh.mockClear();
    phase = "action";
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
    requestHeaders = stale();
    await expect(assertActionOrg(ctx)).rejects.toBeInstanceOf(OrgChangedActionError);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("lets the page render that follows the refused action through, on the real org", async () => {
    // Same request, same headers - but Next has moved on to rendering. Refusing
    // here crashed that render and the tab showed "Something went wrong".
    requestHeaders = stale();
    phase = "render";
    await expect(assertActionOrg(ctx)).resolves.toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is not checked outside a request (no work unit store)", async () => {
    requestHeaders = stale();
    phase = undefined;
    await expect(assertActionOrg(ctx)).resolves.toBeUndefined();
  });
});

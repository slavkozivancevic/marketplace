import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateTag = vi.fn();
const updateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, updateTag }));

const { refreshOwnUserCache } = await import("./cache");

describe("refreshOwnUserCache", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    updateTag.mockClear();
  });

  it("expires the user's own entries at once, so the refresh after an org switch renders the new org", () => {
    refreshOwnUserCache("u1", "clerk_1");
    // The dashboard layout's fetchLayoutUser is tagged with byClerkId: a
    // stale-while-revalidate there brought the old org back on the switch.
    expect(updateTag).toHaveBeenCalledWith("id:users:clerk:clerk_1");
    expect(updateTag).toHaveBeenCalledWith("id:users:u1");
    // The broad list tag keeps the cheap stale-while-revalidate.
    expect(revalidateTag).toHaveBeenCalledWith("global:users", "max");
  });
});

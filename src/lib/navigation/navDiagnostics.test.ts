import { describe, it, expect } from "vitest";
import { classify, sanitizeUrl } from "./navDiagnostics";

const origin = "https://marketverseapp.com";

describe("sanitizeUrl", () => {
  it("keeps path and search for this site", () => {
    expect(sanitizeUrl("https://marketverseapp.com/sr/admin/brands?_rsc=abc", origin)).toBe("/sr/admin/brands?_rsc=abc");
  });

  it("cuts sign-in tickets and handshakes out, never into the logs", () => {
    const u = sanitizeUrl("/sr/sign-in?__clerk_ticket=eyJsecret&redirect_url=%2Fsr", origin);
    expect(u).not.toContain("eyJsecret");
    expect(u).toContain("redirect_url=%2Fsr");
    expect(sanitizeUrl("/sr?__clerk_handshake=xyz", origin)).not.toContain("xyz");
  });

  it("keeps only origin and path for another site", () => {
    expect(sanitizeUrl("https://clerk.example.com/v1/client?token=1", origin)).toBe("https://clerk.example.com/v1/client");
  });
});

describe("classify", () => {
  it("tells navigations, prefetches and server actions apart", () => {
    expect(classify({ headers: { RSC: "1" } }, "/x")).toBe("nav");
    expect(classify({ headers: { rsc: "1", "Next-Router-Prefetch": "1" } }, "/x")).toBe("prefetch");
    expect(classify({ headers: new Headers({ "Next-Action": "abc" }) }, "/x")).toBe("action");
  });

  it("ignores every other fetch", () => {
    expect(classify(undefined, "/api/products")).toBeNull();
    expect(classify({ headers: [["accept", "application/json"]] }, "/api/x")).toBeNull();
  });
});

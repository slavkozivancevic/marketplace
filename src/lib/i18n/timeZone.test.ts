import { describe, it, expect } from "vitest";
import { validTimeZone } from "./timeZone";

describe("validTimeZone", () => {
  it("accepts an IANA zone the runtime knows", () => {
    expect(validTimeZone("Europe/Belgrade")).toBe("Europe/Belgrade");
    expect(validTimeZone("UTC")).toBe("UTC");
  });

  it("rejects anything else, so a forged cookie cannot break the page", () => {
    expect(validTimeZone("Mars/Olympus")).toBeNull();
    expect(validTimeZone("")).toBeNull();
    expect(validTimeZone(undefined)).toBeNull();
    expect(validTimeZone("x".repeat(65))).toBeNull();
  });

  it("is what turns the server's UTC into the viewer's clock", () => {
    const placed = new Date("2026-10-31T07:29:00Z");
    const fmt = (timeZone: string) =>
      placed.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit", timeZone });
    expect(fmt("UTC")).toBe("07:29");
    expect(fmt(validTimeZone("Europe/Belgrade")!)).toBe("08:29");
  });
});

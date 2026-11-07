import { describe, it, expect } from "vitest";
import { verifySearchResults } from "./searchResults";

const hit = (otherUserId: string, otherUserNameDisplay: string) => ({
  conversationId: `c-${otherUserId}`,
  otherUserId,
  otherUserNameDisplay,
});

describe("verifySearchResults", () => {
  it("drops a deleted account, whatever name the index still has for it", () => {
    const out = verifySearchResults(
      [hit("u1", "Demo Buyer 9f2a")],
      [{ id: "u1", name: "Deleted User", deletedAt: new Date() }],
      "buyer",
    );
    expect(out).toEqual([]);
  });

  it("drops a hit whose current name no longer matches (renamed since indexed)", () => {
    const out = verifySearchResults(
      [hit("u1", "Marija Petrović")],
      [{ id: "u1", name: "Marija Živančević", deletedAt: null }],
      "petrović",
    );
    expect(out).toEqual([]);
  });

  it("keeps a match and sends back the current name, case-insensitive", () => {
    const out = verifySearchResults(
      [hit("u1", "marija old")],
      [{ id: "u1", name: "Marija Živančević", deletedAt: null }],
      "MARIJA",
    );
    expect(out).toEqual([{ ...hit("u1", "Marija Živančević") }]);
  });

  it("drops a hit for a user this database does not know", () => {
    expect(verifySearchResults([hit("ghost", "Someone")], [], "some")).toEqual([]);
  });
});

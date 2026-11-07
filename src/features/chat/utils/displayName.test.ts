import { describe, it, expect } from "vitest";
import { chatDisplayName } from "./displayName";

describe("chatDisplayName", () => {
  it("shows the name of an existing account", () => {
    expect(chatDisplayName({ name: "Marija", imageUrl: null, deleted: false }, "Obrisan nalog")).toBe("Marija");
  });

  it("shows the localized label for a deleted account, never a name", () => {
    expect(chatDisplayName({ name: null, imageUrl: null, deleted: true }, "Obrisan nalog")).toBe("Obrisan nalog");
    // Even if a name slipped through, a deleted account does not show it.
    expect(chatDisplayName({ name: "Demo Buyer", imageUrl: null, deleted: true }, "Obrisan nalog")).toBe("Obrisan nalog");
  });

  it("is empty while the profile is not loaded", () => {
    expect(chatDisplayName(undefined, "Obrisan nalog")).toBe("");
  });
});

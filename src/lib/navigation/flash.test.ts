import { describe, it, expect, vi, afterEach } from "vitest";
import { setFlash, takeFlashFor } from "./flash";

const LIST = "/en/admin/tags";
const ELSEWHERE = "/en/admin/brands";

afterEach(() => {
  vi.useRealTimers();
  // Drain anything a test left queued - the store is module state.
  takeFlashFor(LIST);
});

describe("navigation flash", () => {
  it("hands the queued message to the page it was addressed to", () => {
    setFlash("Tag created", { path: LIST });
    expect(takeFlashFor(LIST)).toEqual({
      kind: "success",
      message: "Tag created",
    });
  });

  it("is consumed once, so a later navigation gets nothing", () => {
    setFlash("Tag created", { path: LIST });
    takeFlashFor(LIST);
    expect(takeFlashFor(LIST)).toBeNull();
  });

  it("does not surface on a page it was not addressed to", () => {
    // The save landed but the user went somewhere else instead. "Tag created"
    // has no business appearing over the brands table.
    setFlash("Tag created", { path: LIST });
    expect(takeFlashFor(ELSEWHERE)).toBeNull();
  });

  it("keeps waiting for its own page after a detour", () => {
    setFlash("Tag created", { path: LIST });
    takeFlashFor(ELSEWHERE);
    expect(takeFlashFor(LIST)?.message).toBe("Tag created");
  });

  it("keeps the kind, so a queued failure is not announced as a success", () => {
    setFlash("Could not save", { path: LIST, kind: "error" });
    expect(takeFlashFor(LIST)).toEqual({
      kind: "error",
      message: "Could not save",
    });
  });

  it("keeps only the most recent message", () => {
    setFlash("first", { path: LIST });
    setFlash("second", { path: LIST });
    expect(takeFlashFor(LIST)?.message).toBe("second");
    expect(takeFlashFor(LIST)).toBeNull();
  });

  it("ignores a query string on the target, which usePathname never reports", () => {
    setFlash("Tag created", { path: `${LIST}?page=2#top` });
    expect(takeFlashFor(LIST)?.message).toBe("Tag created");
  });

  it("still delivers across a slow navigation", () => {
    vi.useFakeTimers();
    setFlash("Tag created", { path: LIST });
    vi.advanceTimersByTime(30_000);
    expect(takeFlashFor(LIST)?.message).toBe("Tag created");
  });

  it("drops a message whose navigation never happened", () => {
    // The push failed or the user went back instead: wandering onto the list by
    // hand ten minutes later must not confirm a save nobody remembers making.
    vi.useFakeTimers();
    setFlash("Tag created", { path: LIST });
    vi.advanceTimersByTime(61_000);
    expect(takeFlashFor(LIST)).toBeNull();
  });

  it("clears an expired message even when it is passed over", () => {
    vi.useFakeTimers();
    setFlash("Tag created", { path: LIST });
    vi.advanceTimersByTime(61_000);
    takeFlashFor(ELSEWHERE);
    expect(takeFlashFor(LIST)).toBeNull();
  });

  it("without a target, goes to the first page that asks", () => {
    setFlash("Saved");
    expect(takeFlashFor(ELSEWHERE)?.message).toBe("Saved");
  });
});

import { describe, it, expect } from "vitest";
import { MAX_SELECTION, tapIntent, toggleId } from "./selection";
import { SWIPE_MAX_PX, SWIPE_REPLY_PX, swipeAxis, swipeFires, swipeOffset } from "./swipe";

describe("selection mode, as on WhatsApp", () => {
  it("a tap adds an item, a tap on a picked one takes it away", () => {
    expect(toggleId(["a"], "b")).toEqual({ ids: ["a", "b"], full: false });
    expect(toggleId(["a", "b"], "a")).toEqual({ ids: ["b"], full: false });
  });

  it("stops at the batch limit, leaving the selection as it was", () => {
    const full = Array.from({ length: MAX_SELECTION }, (_, i) => `m${i}`);
    expect(toggleId(full, "one-more")).toEqual({ ids: full, full: true });
    // Taking one away still works when full.
    expect(toggleId(full, "m0").ids).toHaveLength(MAX_SELECTION - 1);
  });

  it("a tap opens outside selection mode and toggles inside it", () => {
    expect(tapIntent(false)).toBe("open");
    expect(tapIntent(true)).toBe("toggle");
  });
});

describe("swipe to reply", () => {
  it("waits within the long-press slop before deciding", () => {
    expect(swipeAxis(5, 3, "pending")).toBe("pending");
  });

  it("a rightward, mostly sideways drag is a reply; anything else stays a scroll", () => {
    expect(swipeAxis(20, 5, "pending")).toBe("reply");
    expect(swipeAxis(5, 20, "pending")).toBe("none");
    expect(swipeAxis(-20, 0, "pending")).toBe("none");
    // Vertical wins a tie: a scroll must never become a reply.
    expect(swipeAxis(15, 15, "pending")).toBe("none");
  });

  it("locks once: a scroll that later moves sideways does not become a reply", () => {
    expect(swipeAxis(80, 0, "none")).toBe("none");
    expect(swipeAxis(0, 80, "reply")).toBe("reply");
  });

  it("fires on release past the threshold, and the bubble follows only so far", () => {
    expect(swipeFires(SWIPE_REPLY_PX - 1)).toBe(false);
    expect(swipeFires(SWIPE_REPLY_PX)).toBe(true);
    expect(swipeOffset(-10)).toBe(0);
    expect(swipeOffset(500)).toBe(SWIPE_MAX_PX);
  });
});

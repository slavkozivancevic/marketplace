import { describe, expect, it, vi } from "vitest";
import { IMAGE_RETRY_DELAYS_MS, imageRetryDelay, onImageRevival } from "./imageRetry";

function fakeTargets() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: "visible" as DocumentVisibilityState,
  });
  return { win, doc };
}

describe("IMAGE_RETRY_DELAYS_MS", () => {
  it("backs off: every delay is longer than the one before", () => {
    for (let i = 1; i < IMAGE_RETRY_DELAYS_MS.length; i++) {
      expect(IMAGE_RETRY_DELAYS_MS[i]).toBeGreaterThan(IMAGE_RETRY_DELAYS_MS[i - 1]);
    }
  });

  it("outlasts a cold optimizer (more than the old 4.5s window)", () => {
    const total = IMAGE_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(15_000);
  });
});

describe("imageRetryDelay", () => {
  it("returns the delay while the budget lasts, then null", () => {
    expect(imageRetryDelay(0)).toBe(IMAGE_RETRY_DELAYS_MS[0]);
    expect(imageRetryDelay(IMAGE_RETRY_DELAYS_MS.length)).toBeNull();
  });
});

describe("onImageRevival", () => {
  it("revives when the connection comes back", () => {
    const targets = fakeTargets();
    const revive = vi.fn();
    onImageRevival(revive, targets);
    targets.win.dispatchEvent(new Event("online"));
    expect(revive).toHaveBeenCalledTimes(1);
  });

  it("revives when the tab becomes visible, not when it is hidden", () => {
    const targets = fakeTargets();
    const revive = vi.fn();
    onImageRevival(revive, targets);

    targets.doc.visibilityState = "hidden";
    targets.doc.dispatchEvent(new Event("visibilitychange"));
    expect(revive).not.toHaveBeenCalled();

    targets.doc.visibilityState = "visible";
    targets.doc.dispatchEvent(new Event("visibilitychange"));
    expect(revive).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unsubscribed", () => {
    const targets = fakeTargets();
    const revive = vi.fn();
    const unsubscribe = onImageRevival(revive, targets);
    unsubscribe();
    targets.win.dispatchEvent(new Event("online"));
    targets.doc.dispatchEvent(new Event("visibilitychange"));
    expect(revive).not.toHaveBeenCalled();
  });
});

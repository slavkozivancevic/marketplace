import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLongPress, LONG_PRESS_MS, LONG_PRESS_SHOW_MS, LONG_PRESS_SLOP_PX } from "./longPress";

function setup() {
  const show = vi.fn();
  const hide = vi.fn();
  return { show, hide, lp: createLongPress({ show, hide }) };
}

describe("createLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a short tap neither shows the label nor swallows the click", () => {
    const { show, lp } = setup();
    lp.down("touch", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    lp.end();
    vi.advanceTimersByTime(1000);
    expect(show).not.toHaveBeenCalled();
    expect(lp.consumeClick()).toBe(false);
  });

  it("holding shows the label once and swallows exactly the next click", () => {
    const { show, lp } = setup();
    lp.down("touch", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    lp.end();
    expect(show).toHaveBeenCalledTimes(1);
    expect(lp.consumeClick()).toBe(true);
    // The click after that is an ordinary tap again.
    expect(lp.consumeClick()).toBe(false);
  });

  it("hides the label on its own after it has been read", () => {
    const { hide, lp } = setup();
    lp.down("touch", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS + LONG_PRESS_SHOW_MS - 1);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("a new touch clears a click flag the OS never delivered", () => {
    const { lp } = setup();
    lp.down("touch", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    lp.end();
    // No click came (the OS opened its own menu); the next tap must still act.
    lp.down("touch", 0, 0);
    lp.end();
    expect(lp.consumeClick()).toBe(false);
  });

  it("moving past the slop is a scroll, not a press", () => {
    const { show, lp } = setup();
    lp.down("touch", 0, 0);
    lp.move(LONG_PRESS_SLOP_PX, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS / 2);
    lp.move(LONG_PRESS_SLOP_PX + 1, 1);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(show).not.toHaveBeenCalled();
    expect(lp.consumeClick()).toBe(false);
  });

  it("a mouse never starts a press - it has hover", () => {
    const { show, lp } = setup();
    lp.down("mouse", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(show).not.toHaveBeenCalled();
  });

  it("a pen does, like a finger", () => {
    const { show, lp } = setup();
    lp.down("pen", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("dispose cancels a pending press and a pending hide", () => {
    const { show, hide, lp } = setup();
    lp.down("touch", 0, 0);
    lp.dispose();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(show).not.toHaveBeenCalled();

    lp.down("touch", 0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    lp.dispose();
    vi.advanceTimersByTime(LONG_PRESS_SHOW_MS);
    expect(hide).not.toHaveBeenCalled();
  });
});

describe("createLongPress default timers", () => {
  it("calls setTimeout unbound, the way the browser requires", () => {
    // The browser throws "Illegal invocation" when setTimeout runs with a
    // `this` other than the global object; Node does not, so assert it here.
    const real = globalThis.setTimeout;
    const strict = vi.fn(function (this: unknown, fn: () => void, ms?: number) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return real(fn, ms);
    });
    vi.stubGlobal("setTimeout", strict);
    try {
      const lp = createLongPress({ show: vi.fn(), hide: vi.fn() });
      expect(() => lp.down("touch", 0, 0)).not.toThrow();
      expect(strict).toHaveBeenCalledTimes(1);
      lp.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

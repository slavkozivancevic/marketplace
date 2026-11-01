/** How long a touch must be held to count as a long press, in ms. */
export const LONG_PRESS_MS = 500;
/** Movement beyond this many px is a scroll or a swipe, not a press - the same threshold as `useTouchHover`. */
export const LONG_PRESS_SLOP_PX = 8;
/** How long the revealed label stays up before it closes by itself, in ms. */
export const LONG_PRESS_SHOW_MS = 1500;

export type LongPress = {
  /** A pointer went down. Only touch and pen start a press; a mouse has hover. */
  down: (pointerType: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  /** Pointer up or cancel: a press still pending is abandoned. */
  end: () => void;
  /**
   * Asked by the click that follows the pointer up. True once after a long
   * press fired - that click must not run the action - and false otherwise.
   */
  consumeClick: () => boolean;
  /** Cancels a pending press and a pending auto-close. */
  dispose: () => void;
};

type Timers = { set: typeof setTimeout; clear: typeof clearTimeout };

/**
 * The touch counterpart of a hover tooltip: hold an icon button to read its
 * label, without running it. A short tap still runs the action, exactly as
 * before. `show` fires when the press is recognised and `hide` once the label
 * has been up for `LONG_PRESS_SHOW_MS`. Pure (timers injected) so it is
 * testable without a DOM.
 *
 * Without `hide` nothing closes by itself: the chat uses that to select a
 * message or a conversation, which stays selected until the user clears it
 * (as on WhatsApp) - same press, same thresholds, no timer racing the user.
 */
export function createLongPress(
  callbacks: { show: () => void; hide?: () => void },
  // Wrapped, not `{ set: setTimeout }`: called as `timers.set(...)` the
  // browser's setTimeout gets `timers` as `this` and throws "Illegal
  // invocation". The injected fakes in the tests never noticed.
  timers: Timers = {
    set: ((fn: () => void, ms?: number) => setTimeout(fn, ms)) as typeof setTimeout,
    clear: (id) => clearTimeout(id),
  },
): LongPress {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let origin: { x: number; y: number } | null = null;
  let fired = false;

  const cancelPress = () => {
    if (pressTimer !== null) timers.clear(pressTimer);
    pressTimer = null;
    origin = null;
  };

  return {
    down(pointerType, x, y) {
      cancelPress();
      // A new touch starts clean: had the OS swallowed the click after the
      // last long press, its flag must not eat this tap.
      fired = false;
      if (pointerType !== "touch" && pointerType !== "pen") return;
      origin = { x, y };
      pressTimer = timers.set(() => {
        pressTimer = null;
        fired = true;
        callbacks.show();
        const hide = callbacks.hide;
        if (!hide) return;
        if (hideTimer !== null) timers.clear(hideTimer);
        hideTimer = timers.set(() => {
          hideTimer = null;
          hide();
        }, LONG_PRESS_SHOW_MS);
      }, LONG_PRESS_MS);
    },
    move(x, y) {
      if (!origin) return;
      if (Math.hypot(x - origin.x, y - origin.y) > LONG_PRESS_SLOP_PX) cancelPress();
    },
    end: cancelPress,
    consumeClick() {
      const swallow = fired;
      fired = false;
      return swallow;
    },
    dispose() {
      cancelPress();
      if (hideTimer !== null) timers.clear(hideTimer);
      hideTimer = null;
    },
  };
}

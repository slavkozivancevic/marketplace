"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { swipeAxis, swipeFires, swipeOffset, type SwipeAxis } from "../utils/swipe";

/**
 * Swipe a bubble to the right to answer it, as on WhatsApp and Viber - touch
 * only (a mouse has the menu and the header). The bubble follows the finger,
 * a reply arrow fades in behind it, the phone ticks once when the drag passes
 * the threshold, and on release past it `onReply` runs and the bubble springs
 * back. A drag that starts more vertical than sideways is left to the scroll.
 *
 * `enabled: false` (selection mode, an unsent or deleted message) turns it off.
 * The row needs `touch-action: pan-y` so the browser keeps vertical scrolling
 * and hands sideways movement to us.
 */
export function useSwipeReply(onReply: () => void, enabled: boolean) {
  const [offset, setOffset] = useState(0);
  const callback = useRef(onReply);
  useEffect(() => {
    callback.current = onReply;
  });
  const drag = useRef<{ x: number; y: number; axis: SwipeAxis; armed: boolean; id: number } | null>(null);

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.axis === "reply" && d.armed) callback.current();
    setOffset(0);
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || e.pointerType !== "touch") return;
      drag.current = { x: e.clientX, y: e.clientY, axis: "pending", armed: false, id: e.pointerId };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      d.axis = swipeAxis(dx, e.clientY - d.y, d.axis);
      if (d.axis !== "reply") return;
      const armed = swipeFires(dx);
      if (armed && !d.armed) navigator.vibrate?.(10);
      d.armed = armed;
      setOffset(swipeOffset(dx));
    },
    onPointerUp: end,
    onPointerCancel: () => {
      drag.current = null;
      setOffset(0);
    },
  };

  return { handlers, offset, swiping: offset > 0 };
}

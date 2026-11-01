"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import { createLongPress, type LongPress } from "@/lib/longPress";

/**
 * The gestures that select an inbox row or a message, as on WhatsApp:
 *
 * - touch: a held press (`LONG_PRESS_MS`, the same press `IconButton` uses for
 *   its label). A short tap still opens the row; a scroll never selects. The
 *   click the browser fires after the held press is swallowed, so selecting a
 *   row does not also open it.
 * - mouse: right-click. (The visible way is the hover chevron each surface
 *   renders as an `IconButton`; this is the shortcut.)
 *
 * `onSelect(source)` says which: the thread opens the emoji bar only for
 * "press", because a phone has no hover trigger for it.
 *
 * The press lives in a ref made in an effect, and every ref is read only from
 * an event handler - never during render.
 */
export function useSelectGesture(onSelect: (source: "press" | "contextmenu") => void) {
  const callback = useRef(onSelect);
  useEffect(() => {
    callback.current = onSelect;
  });
  const pressRef = useRef<LongPress | null>(null);
  useEffect(() => {
    const press = createLongPress({ show: () => callback.current("press") });
    pressRef.current = press;
    return () => {
      press.dispose();
      pressRef.current = null;
    };
  }, []);

  return {
    onPointerDown: (e: React.PointerEvent) => pressRef.current?.down(e.pointerType, e.clientX, e.clientY),
    onPointerMove: (e: React.PointerEvent) => pressRef.current?.move(e.clientX, e.clientY),
    onPointerUp: () => pressRef.current?.end(),
    onPointerCancel: () => pressRef.current?.end(),
    onClickCapture: (e: React.MouseEvent) => {
      if (pressRef.current?.consumeClick()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      // Android also fires contextmenu for a held press; that one was already
      // handled by the press, and the system menu must not open over it.
      e.preventDefault();
      if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
      callback.current("contextmenu");
    },
  };
}

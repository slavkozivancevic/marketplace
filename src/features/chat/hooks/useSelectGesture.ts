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
 * `onTap`, passed while the surface is in selection mode, takes over a plain
 * tap or click: it picks or un-picks the row and the row's own click (open the
 * conversation) never runs - as on WhatsApp, where a tap in selection mode
 * never opens anything.
 *
 * The press lives in a ref made in an effect, and every ref is read only from
 * an event handler - never during render.
 */
/**
 * An event the row's gestures must leave alone: one on a control with a click
 * of its own (`data-own-click`), or one that only reaches the row through
 * React - a portal (the menu's items, a confirm dialog) is a child of the row
 * in React's tree, so its clicks bubble here although the DOM puts them
 * elsewhere. Taking those as a tap on the row swallowed every menu item in
 * selection mode and only un-picked the message.
 */
function ownEvent(e: React.SyntheticEvent): boolean {
  const target = e.target as Node;
  if (!(e.currentTarget as Node).contains(target)) return true;
  return target instanceof Element && target.closest("[data-own-click]") !== null;
}

/** A control inside the row that a plain click must still reach. */
const INTERACTIVE = "a, button, video, audio, input, textarea, [role='button'], [data-own-click]";

/**
 * `onMouseClick`, when given, makes a plain left click with a MOUSE select the
 * row outside selection mode (the thread's messages: with no menu chevron any
 * more, the bubble itself is the affordance - hover tint and pointer cursor).
 * Not for touch, where a tap does nothing and the held press selects; not for
 * a click on a control inside the row; not for the click that ends dragging a
 * text selection.
 */
export function useSelectGesture(
  onSelect: (source: "press" | "contextmenu") => void,
  onTap?: (() => void) | null,
  onMouseClick?: (() => void) | null,
) {
  const callback = useRef(onSelect);
  const tap = useRef(onTap);
  const mouseClick = useRef(onMouseClick);
  useEffect(() => {
    callback.current = onSelect;
    tap.current = onTap;
    mouseClick.current = onMouseClick;
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
    onPointerDown: (e: React.PointerEvent) => {
      // A press that starts on a control of its own (`data-own-click`: the
      // emoji bar, a reaction badge, the menu chevron) is that control's -
      // holding an emoji a beat too long must not toggle the selection
      // instead of reacting.
      if (ownEvent(e)) return;
      pressRef.current?.down(e.pointerType, e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => pressRef.current?.move(e.clientX, e.clientY),
    onPointerUp: () => pressRef.current?.end(),
    onPointerCancel: () => pressRef.current?.end(),
    onClickCapture: (e: React.MouseEvent) => {
      // A control of its own (the emoji bar, a reaction badge) always gets
      // its click, and clears the "swallow the click after a held press" flag
      // on the way. The press that opens the emoji bar often ends without the
      // browser firing that click at all (Android takes it), so the flag was
      // left set - and since a press starting on such a control does not
      // reset it (onPointerDown above), the first tap on an emoji was
      // swallowed and only the second one reacted.
      if (ownEvent(e)) {
        pressRef.current?.consumeClick();
        return;
      }
      if (pressRef.current?.consumeClick()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (tap.current) {
        e.preventDefault();
        e.stopPropagation();
        tap.current();
        return;
      }
      if (
        mouseClick.current &&
        e.button === 0 &&
        (e.nativeEvent as PointerEvent).pointerType === "mouse" &&
        !(e.target as Element).closest(INTERACTIVE) &&
        !window.getSelection()?.toString()
      ) {
        mouseClick.current();
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (ownEvent(e)) return;
      // Android also fires contextmenu for a held press; that one was already
      // handled by the press, and the system menu must not open over it.
      e.preventDefault();
      if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
      callback.current("contextmenu");
    },
  };
}

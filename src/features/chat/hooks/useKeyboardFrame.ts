"use client";

import { useEffect, useState } from "react";
import { useSupportsHover } from "@/hooks/useSupportsHover";
import { keyboardFrame } from "../utils/keyboardFrame";

/** Marks a chat surface: a text field inside it is "typing in chat". */
export const CHAT_SURFACE_ATTR = "data-chat-surface";

function isTypingInChat(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) return false;
  return !!el.closest(`[${CHAT_SURFACE_ATTR}]`);
}

/**
 * The visible area above the phone's keyboard while a chat field has the
 * focus, as `{ top, height }` for a fixed-position chat surface, or null (see
 * `keyboardFrame` for when). Follows the keyboard opening, closing and the
 * browser scrolling the visible area, through `visualViewport`.
 *
 * Inert on a device that hovers: no listener is even attached.
 */
export function useKeyboardFrame(): { top: number; height: number } | null {
  const supportsHover = useSupportsHover();
  const [frame, setFrame] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (supportsHover || !vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = keyboardFrame({
          innerHeight: window.innerHeight,
          visibleHeight: vv.height,
          offsetTop: vv.offsetTop,
          scale: vv.scale,
          supportsHover: false,
          typingInChat: isTypingInChat(document.activeElement),
        });
        setFrame((prev) =>
          prev?.top === next?.top && prev?.height === next?.height ? prev : next,
        );
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [supportsHover]);

  // A device that switched to a mouse mid-keyboard (a 2-in-1) drops it at once.
  return supportsHover ? null : frame;
}

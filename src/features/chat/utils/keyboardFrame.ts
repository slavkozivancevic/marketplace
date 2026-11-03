/**
 * How much shorter the visible area must be than the window before we call it
 * an on-screen keyboard. A phone's collapsing address bar takes 50-100px; a
 * keyboard takes 250px or more.
 */
export const KEYBOARD_MIN_PX = 150;

export interface ViewportState {
  /** `window.innerHeight` - the layout viewport, which a keyboard does not shrink. */
  innerHeight: number;
  /** `visualViewport.height` - what is actually visible above the keyboard. */
  visibleHeight: number;
  /** `visualViewport.offsetTop` - how far the browser scrolled the visible area down. */
  offsetTop: number;
  /** `visualViewport.scale` - pinch zoom also shrinks the visible area; that is not a keyboard. */
  scale: number;
  /** The device's primary input can hover (a mouse): never a keyboard to fit around. */
  supportsHover: boolean;
  /** The focus is in a text field of a chat surface. */
  typingInChat: boolean;
}

/**
 * Where a chat surface goes while the phone's keyboard is open, or null to
 * leave it alone, as on WhatsApp: the browser does not shrink the page for the
 * keyboard, it scrolls it up to keep the field in sight - which pushes the
 * header and the newest messages off the top. Pinning the chat to the visible
 * area keeps the header at the top and the composer right above the keyboard.
 *
 * Null whenever any condition is missing, so a desktop (it hovers), a phone
 * with the keyboard closed, a pinch zoom, or a field outside the chat never
 * sees any of it.
 */
export function keyboardFrame(s: ViewportState): { top: number; height: number } | null {
  if (s.supportsHover || !s.typingInChat) return null;
  if (Math.abs(s.scale - 1) > 0.01) return null;
  if (s.innerHeight - s.visibleHeight < KEYBOARD_MIN_PX) return null;
  return { top: Math.round(s.offsetTop), height: Math.round(s.visibleHeight) };
}

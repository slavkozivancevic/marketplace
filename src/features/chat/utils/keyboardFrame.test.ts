import { describe, it, expect } from "vitest";
import { KEYBOARD_MIN_PX, keyboardFrame, type ViewportState } from "./keyboardFrame";

const phoneTyping: ViewportState = {
  innerHeight: 844,
  visibleHeight: 480,
  offsetTop: 120,
  scale: 1,
  supportsHover: false,
  typingInChat: true,
};

describe("keyboardFrame - the chat sits above the phone keyboard, as on WhatsApp", () => {
  it("pins the chat to the visible area while typing with the keyboard open", () => {
    expect(keyboardFrame(phoneTyping)).toEqual({ top: 120, height: 480 });
  });

  it("never applies on a device with a mouse", () => {
    expect(keyboardFrame({ ...phoneTyping, supportsHover: true })).toBeNull();
  });

  it("leaves a field outside the chat alone", () => {
    expect(keyboardFrame({ ...phoneTyping, typingInChat: false })).toBeNull();
  });

  it("is not fooled by the address bar collapsing or a pinch zoom", () => {
    expect(keyboardFrame({ ...phoneTyping, visibleHeight: 844 - KEYBOARD_MIN_PX + 1, offsetTop: 0 })).toBeNull();
    expect(keyboardFrame({ ...phoneTyping, scale: 1.6 })).toBeNull();
  });
});

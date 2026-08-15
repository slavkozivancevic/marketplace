import { useEffect, useState } from "react";

/**
 * True when the device's primary input can hover (mouse/trackpad), false for
 * touch/stylus-primary devices. Read once up-front via a lazy initializer
 * (SSR default true, matching pre-touch-support behavior) and kept in sync
 * for devices that can switch primary input, e.g. a 2-in-1 laptop.
 */
export function useSupportsHover(): boolean {
  const [supportsHover, setSupportsHover] = useState(() =>
    typeof window === "undefined" || !window.matchMedia
      ? true
      : window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = (e: MediaQueryListEvent) => setSupportsHover(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return supportsHover;
}
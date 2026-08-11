"use client";

// Coordinates HoverImageCycler instances on touch/no-hover devices: instead
// of every visible card cycling its images at once (chaotic on a dense
// mobile grid), exactly one card - the one nearest the vertical center of
// the viewport - is ever "in focus" at a time, mimicking a carousel's active
// slide as the user scrolls. A single shared IntersectionObserver drives all
// registered cards so cost stays flat regardless of grid size.

type Registration = {
  onFocus: () => void;
  onBlur: () => void;
};

const registry = new Map<Element, Registration>();
const intersecting = new Set<Element>();
let activeEl: Element | null = null;
let observer: IntersectionObserver | null = null;

function pickWinner(): Element | null {
  if (intersecting.size === 0) return null;
  const viewportCenter = window.innerHeight / 2;
  let winner: Element | null = null;
  let winnerDist = Infinity;
  for (const el of intersecting) {
    const rect = el.getBoundingClientRect();
    const dist = Math.abs(rect.top + rect.height / 2 - viewportCenter);
    if (dist < winnerDist) {
      winnerDist = dist;
      winner = el;
    }
  }
  return winner;
}

function reconcile() {
  const winner = pickWinner();
  if (winner === activeEl) return;
  if (activeEl) registry.get(activeEl)?.onBlur();
  activeEl = winner;
  if (activeEl) registry.get(activeEl)?.onFocus();
}

function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target);
          else intersecting.delete(entry.target);
        }
        reconcile();
      },
      // Shrinks the effective root to a thin band around vertical center,
      // so a card only registers as a focus candidate while it's crossing
      // the middle of the screen - not merely "somewhere on screen".
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
  }
  return observer;
}

/** Registers `el` as a focus candidate; returns a cleanup function. */
export function registerTouchFocusCycle(
  el: Element,
  callbacks: Registration,
): () => void {
  registry.set(el, callbacks);
  getObserver().observe(el);
  return () => {
    getObserver().unobserve(el);
    registry.delete(el);
    intersecting.delete(el);
    if (activeEl === el) {
      activeEl = null;
      reconcile();
    }
  };
}

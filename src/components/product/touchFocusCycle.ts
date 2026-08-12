"use client";

// Coordinates HoverImageCycler instances on touch/no-hover devices: instead
// of every visible card cycling its images at once (chaotic on a dense
// mobile grid), only the row nearest the vertical center of the viewport is
// ever "in focus" at a time, mimicking a carousel's active slide as the user
// scrolls. A single shared IntersectionObserver drives all registered cards
// so cost stays flat regardless of grid size.
//
// "Row" isn't tracked via grid/DOM structure (cards register independently,
// with no shared parent contract) - it's inferred purely from geometry: a
// CSS grid lays every card in a row out with an identical `top`, so cards
// within a small pixel tolerance of each other are treated as the same row.

type Registration = {
  onFocus: () => void;
  onBlur: () => void;
};

// Cards in the same row align exactly in a CSS grid; this only needs to
// absorb subpixel/rounding drift, not real layout differences.
const ROW_TOLERANCE_PX = 4;

const registry = new Map<Element, Registration>();
const intersecting = new Set<Element>();
let activeGroup = new Set<Element>();
let observer: IntersectionObserver | null = null;

function pickActiveRow(): Set<Element> {
  if (intersecting.size === 0) return new Set();
  const viewportCenter = window.innerHeight / 2;
  const items = Array.from(intersecting, (el) => {
    const rect = el.getBoundingClientRect();
    return { el, top: rect.top, dist: Math.abs(rect.top + rect.height / 2 - viewportCenter) };
  });
  items.sort((a, b) => a.dist - b.dist);
  const anchorTop = items[0].top;
  return new Set(
    items
      .filter((item) => Math.abs(item.top - anchorTop) <= ROW_TOLERANCE_PX)
      .map((item) => item.el),
  );
}

function reconcile() {
  const nextGroup = pickActiveRow();
  for (const el of activeGroup) {
    if (!nextGroup.has(el)) registry.get(el)?.onBlur();
  }
  for (const el of nextGroup) {
    if (!activeGroup.has(el)) registry.get(el)?.onFocus();
  }
  activeGroup = nextGroup;
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
    if (activeGroup.has(el)) reconcile();
  };
}

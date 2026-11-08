/**
 * Menu aim: whether a pointer moving across a vertical list is heading for the
 * panel to its right, so the department it is only passing over on the way
 * must not take over the panel.
 *
 * The test is the classic one (Amazon's mega menu): the pointer is aiming at
 * the panel while it stays inside the triangle between where it was a moment
 * ago and the panel's top-left and bottom-left corners, which it does exactly
 * when it moves right and its slope points between the two corners.
 */

export type Point = { x: number; y: number };
export type PanelEdge = { left: number; top: number; bottom: number };

/** Slack, in px, so a pointer resting on the line itself still counts. */
const TOLERANCE = 6;

export function isAimingAt(prev: Point, cur: Point, panel: PanelEdge): boolean {
  // Standing still, or moving left or straight down: not heading anywhere.
  if (cur.x <= prev.x) return false;
  // Already past the rail: the panel takes it from here.
  if (cur.x >= panel.left) return false;

  const slope = (to: Point) => (to.y - prev.y) / (to.x - prev.x);
  const upper = slope({ x: panel.left, y: panel.top - TOLERANCE });
  const lower = slope({ x: panel.left, y: panel.bottom + TOLERANCE });
  const moving = slope(cur);
  return moving >= upper && moving <= lower;
}

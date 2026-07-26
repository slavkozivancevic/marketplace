/**
 * Repeats a slide list until it clears the content-width bar embla's loop
 * mode needs to build a genuinely seamless wrap (see `canLoop()` in
 * embla-carousel's SlideLooper - it needs roughly 2x the viewport in slide
 * content, cloned from the real slides). Below that bar `opts.loop` silently
 * falls back to non-looping and the carousel just dead-ends at either
 * extreme - duplicating slides is embla's own documented way around this,
 * and it's what makes the loop actually embla's native, battle-tested
 * mechanism instead of a hand-rolled reimplementation of its physics.
 *
 * Only pads when there are at least `minDistinctForLoop` distinct items -
 * that should be at or above the carousel's own maximum number of
 * simultaneously visible slides. Below that count, looping is impossible
 * without showing a repeat of the same item on screen at the same time as
 * the original (there just isn't enough distinct content to fill the widest
 * view once, let alone twice), which reads as broken, not circular - so
 * slides are returned unpadded and the carousel falls back to embla's normal
 * non-looping behavior (arrows fade out at the true end) instead.
 */
export function padForLoop<T>(
  items: T[],
  { minDistinctForLoop = 5, minTotal = 20 }: { minDistinctForLoop?: number; minTotal?: number } = {},
): T[] {
  if (items.length < minDistinctForLoop) return items;
  const repeats = Math.ceil(minTotal / items.length);
  return Array.from({ length: repeats }, () => items).flat();
}

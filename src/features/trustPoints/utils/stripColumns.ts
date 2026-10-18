/**
 * How many columns the trust strip uses on a wide screen.
 *
 * A fixed four looked right until the strip held five promises: four sat in a
 * row and the fifth stood alone underneath, reading like something had broken
 * rather than like a deliberate second row. The admin chooses how many
 * promises there are, so the layout has to answer for any count.
 *
 * The rule is simply "leave the fullest possible last row": for five or more
 * entries, compare three columns against four and keep whichever leaves fewer
 * gaps, preferring four when they tie. Five becomes 3 + 2, six becomes 3 + 3,
 * nine becomes 3 + 3 + 3. Below five the count IS the column count, so three
 * promises spread across the strip instead of hugging its left edge.
 *
 * Narrow screens are not this function's business - they stay at two columns,
 * where a trailing single is the normal shape of any wrapped list.
 */
export function trustStripColumns(count: number): 2 | 3 | 4 {
  if (count <= 2) return 2;
  if (count <= 4) return count === 3 ? 3 : 4;

  // Remainder 0 means the last row is full, which is the best case - score it
  // as the column count itself so it beats any partial row.
  const fullness = (cols: number) => (count % cols === 0 ? cols : count % cols);
  return fullness(4) >= fullness(3) ? 4 : 3;
}

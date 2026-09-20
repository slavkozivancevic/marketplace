/**
 * The identifier half of the duplicate convention: slugs, SKUs, attribute keys
 * and coupon codes.
 *
 * Its counterpart is `copyName`, which prefixes the human-readable name with a
 * localized "Copy of". An identifier cannot carry that - it is matched, typed
 * and unique-constrained - so it gets a suffix instead. A coupon has only a
 * code and no name at all, so for coupons this is the whole convention.
 */
const COPY_MARKER = "-copy-";

/** The marker plus its base36 timestamp, at the end of a value. Case-insensitive
 *  because coupon codes are stored uppercase. */
const COPY_SUFFIX_RE = /-copy-[0-9a-z]+$/i;

/**
 * The identifier for a duplicate of `value`.
 *
 * Any existing copy suffix is stripped first, so duplicating a duplicate
 * replaces the old marker instead of stacking another one. Without that,
 * a chain of copies reads `patike-copy-m9x-copy-m9y-copy-m9z` and grows by 14
 * characters a round until it passes the form's limit.
 *
 * `maxLength` is the form's own limit for the field, and must be passed
 * wherever the schema has one. A duplicate is written straight to the DB (no
 * column length, no Zod), so without it a copy can exist as a row that the edit
 * form then refuses to save.
 *
 * The timestamp is kept whole. Truncating it (the coupon code used to take only
 * its last 4 base36 characters) makes the suffix repeat every 36^4 ms, about 28
 * minutes, and two copies of one source that far apart then collide on the
 * unique index.
 */
export function copyIdentifier(
  value: string,
  maxLength?: number,
  now: number = Date.now(),
): string {
  const suffix = `${COPY_MARKER}${now.toString(36)}`;
  const trimmed = value.trim();
  // `|| trimmed` guards a value that is nothing but a suffix: better a slightly
  // odd identifier than an empty one.
  const base = trimmed.replace(COPY_SUFFIX_RE, "") || trimmed;
  if (maxLength == null) return `${base}${suffix}`;

  // Trim any dash the clipping left dangling, so a clipped base does not read
  // as "black-friday--copy-m9x2".
  const head = base.slice(0, Math.max(0, maxLength - suffix.length)).replace(/-+$/, "");
  return `${head}${suffix}`;
}

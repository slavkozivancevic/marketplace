/**
 * Email masking for the view-only demo accounts.
 *
 * The demo seller and the demo admin are public, and the screens they can open
 * list other people's addresses - members, buyers, reviewers, the audit trail.
 * Masking happens on the server, where the page props or the API JSON are
 * built, so the real address never reaches the browser at all; masking in a
 * component would still ship it in the RSC payload. Names stay readable.
 */

const EMAIL_KEYS = new Set(["email", "actorEmail"]);

/** `slavko@example.com` -> `s***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A copy of `value` with every string under an `email` / `actorEmail` key
 * masked, at any depth. Only arrays and plain objects are walked, so Dates,
 * Decimals and the like come back untouched.
 */
export function maskEmails<T>(value: T): T {
  if (Array.isArray(value)) return value.map(maskEmails) as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = EMAIL_KEYS.has(key) && typeof v === "string" ? maskEmail(v) : maskEmails(v);
  }
  return out as T;
}

/** `maskEmails` for a demo viewer, `value` itself for everyone else. */
export function demoSafe<T>(value: T, viewer: { isDemoReadOnly: boolean }): T {
  return viewer.isDemoReadOnly ? maskEmails(value) : value;
}

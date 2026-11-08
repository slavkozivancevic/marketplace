/**
 * Email masking for the view-only demo accounts.
 *
 * The demo seller and the demo admin are public, and the screens they can open
 * list other people's addresses - members, buyers, reviewers, the audit trail.
 * Masking happens on the server, where the page props or the API JSON are
 * built, so the real address never reaches the browser at all; masking in a
 * component would still ship it in the RSC payload. Names stay readable, except
 * a buyer's on an order, where they sit next to a delivery address - see
 * `demoSafeOrder`.
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

/** `Toma Zojkic` -> `T*** Z***`. Each word keeps its first letter. */
export function maskName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length === 0 ? "***" : words.map((w) => `${w[0]}***`).join(" ");
}

// The street part of an order's delivery address. City and country stay: they
// identify nobody on their own, and the card still reads as a real order.
const ADDRESS_KEYS = new Set(["shippingLine1", "shippingLine2", "shippingPostalCode"]);

function maskBuyer<T>(value: T, inUser = false): T {
  if (Array.isArray(value)) return value.map((v) => maskBuyer(v, inUser)) as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "string" && v !== "") {
      if (EMAIL_KEYS.has(key)) out[key] = maskEmail(v);
      else if (ADDRESS_KEYS.has(key)) out[key] = "***";
      else if (key === "shippingName" || (inUser && key === "name")) out[key] = maskName(v);
      else out[key] = v;
    } else {
      out[key] = maskBuyer(v, key === "user");
    }
  }
  return out as T;
}

/**
 * `demoSafe` for an order (or a page of orders): on top of the emails, the
 * buyer's name - the account's (`user.name`) and the recipient's
 * (`shippingName`) - and the street, house number and postal code. A demo
 * visitor's checkout takes a real address as readily as a fake one, and every
 * other visitor opens the same seller account, so this is not about old test
 * data alone.
 */
export function demoSafeOrder<T>(value: T, viewer: { isDemoReadOnly: boolean }): T {
  return viewer.isDemoReadOnly ? maskBuyer(value) : value;
}

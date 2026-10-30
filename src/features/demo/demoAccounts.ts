/**
 * The public demo accounts linked from the README and the showcase page.
 *
 * Anyone on the internet can sign in as them (`/api/demo/sign-in?as=...`
 * mints a one-time Clerk sign-in token - there is no password to change or
 * leak). So what they may do is decided here, by email, and enforced on the
 * server:
 *
 * - the buyer is an ordinary account: cart, wishlist, Stripe test checkout,
 *   cash on delivery, reviews and chat all work, because trying a purchase is
 *   the point of the demo;
 * - the seller and the admin are view-only: every screen and form opens, but
 *   any write is refused with `DemoReadOnlyError` (see `assertWritable`), so
 *   nobody can deface the public catalog or refund someone's order.
 *
 * The addresses are plus-aliases of the owner's MarketVerse mailbox, so order
 * emails sent to a demo account land somewhere real instead of bouncing (SES
 * is in production mode; bounces count against the account).
 */
export type DemoRole = "buyer" | "seller" | "admin";

export type DemoAccount = {
  email: string;
  firstName: string;
  lastName: string;
  readOnly: boolean;
};

export const DEMO_ACCOUNTS: Record<DemoRole, DemoAccount> = {
  buyer: {
    email: "slavko.zivancevic+demo-buyer@protonmail.com",
    firstName: "Demo",
    lastName: "Buyer",
    readOnly: false,
  },
  seller: {
    email: "slavko.zivancevic+demo-seller@protonmail.com",
    firstName: "Demo",
    lastName: "Seller",
    readOnly: true,
  },
  admin: {
    email: "slavko.zivancevic+demo-admin@protonmail.com",
    firstName: "Demo",
    lastName: "Admin",
    readOnly: true,
  },
};

export const DEMO_ROLES = Object.keys(DEMO_ACCOUNTS) as DemoRole[];

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && (DEMO_ROLES as string[]).includes(value);
}

/**
 * Every visitor who picks "Buyer" gets an account of their own (see
 * demoBuyers.ts), so nobody sees someone else's cart, orders or chat. Each one
 * is a further plus-alias of the buyer's address - order emails still land in
 * the owner's mailbox - tagged with a short code that also ends its name
 * ("Demo Buyer 4f2a9c"), so the owner can tell visitors apart in the inbox.
 */
const [BUYER_LOCAL, BUYER_DOMAIN] = DEMO_ACCOUNTS.buyer.email.split("@");
const VISITOR_BUYER_EMAIL = new RegExp(
  `^${BUYER_LOCAL.replace(/[.+]/g, "\\$&")}-([a-z0-9]{6})@${BUYER_DOMAIN.replace(/\./g, "\\.")}$`,
);

/** A fresh visitor buyer: its address and the code it shares with its name. */
export function newDemoBuyerIdentity(): { email: string; code: string } {
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return { email: `${BUYER_LOCAL}-${code}@${BUYER_DOMAIN}`, code };
}

/** Whether an email belongs to a per-visitor buyer (not the old shared one). */
export function isVisitorBuyerEmail(email: string | null | undefined): boolean {
  return !!email && VISITOR_BUYER_EMAIL.test(email.trim().toLowerCase());
}

/** Clerk's user-search text that narrows its users to visitor buyers (confirm each with isVisitorBuyerEmail). */
export const VISITOR_BUYER_EMAIL_QUERY = `${BUYER_LOCAL}-`;

/** Which demo account an email belongs to, or null for everyone else. */
export function demoRoleOfEmail(email: string | null | undefined): DemoRole | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (isVisitorBuyerEmail(normalized)) return "buyer";
  return DEMO_ROLES.find((role) => DEMO_ACCOUNTS[role].email === normalized) ?? null;
}

export function isDemoReadOnlyEmail(email: string | null | undefined): boolean {
  const role = demoRoleOfEmail(email);
  return role !== null && DEMO_ACCOUNTS[role].readOnly;
}

/**
 * The email to store when Clerk reports a user's primary address. A demo
 * account keeps its own forever: read-only is decided by that stored email,
 * and Clerk's profile screen lets any visitor add an address (or connect a
 * Google account) and make it primary - which, synced, would turn the demo
 * admin into a real one. The DB is the anchor because nothing a visitor does in
 * Clerk can write it; the demo sign-in route puts Clerk back in line.
 */
export function syncedEmail(stored: string | null | undefined, incoming: string): string {
  return stored && demoRoleOfEmail(stored) ? stored : incoming;
}

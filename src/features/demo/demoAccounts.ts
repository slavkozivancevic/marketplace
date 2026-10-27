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

/** Which demo account an email belongs to, or null for everyone else. */
export function demoRoleOfEmail(email: string | null | undefined): DemoRole | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_ROLES.find((role) => DEMO_ACCOUNTS[role].email === normalized) ?? null;
}

export function isDemoReadOnlyEmail(email: string | null | undefined): boolean {
  const role = demoRoleOfEmail(email);
  return role !== null && DEMO_ACCOUNTS[role].readOnly;
}

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { env } from "@/env/server";
import { asLocale } from "@/i18n/config";
import { getClientIp, rateLimitResponse } from "@/lib/rateLimit/guard";
import { DEMO_ACCOUNTS, isDemoRole } from "@/features/demo/demoAccounts";
import { demoTicketUrl } from "@/features/demo/demoSignIn";

/**
 * GET /api/demo/sign-in?as=buyer|seller|admin[&locale=sr]
 *
 * One-click sign-in for the public demo accounts linked from the README and
 * the showcase page. Mints a 60-second Clerk sign-in token and sends the
 * browser to the sign-in page, which redeems it and lands on the account's
 * home screen. The accounts have no password, so there is nothing a visitor
 * can change to lock the next one out.
 *
 * What each account may do is enforced elsewhere - see demoAccounts.ts. This
 * route also puts the account's name back, in case someone renamed it from
 * Clerk's profile screen.
 */
export async function GET(req: NextRequest) {
  const as = req.nextUrl.searchParams.get("as");
  if (!isDemoRole(as)) {
    return NextResponse.json({ error: true, message: "Unknown demo account" }, { status: 400 });
  }

  const limited = await rateLimitResponse("demo", await getClientIp());
  if (limited) return limited;

  const locale = asLocale(
    req.nextUrl.searchParams.get("locale") ?? req.cookies.get("NEXT_LOCALE")?.value,
  );
  const account = DEMO_ACCOUNTS[as];

  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [account.email] });
  const user = data[0];
  if (!user) {
    return NextResponse.json(
      { error: true, message: "Demo accounts are not set up on this stage" },
      { status: 503 },
    );
  }
  if (user.firstName !== account.firstName || user.lastName !== account.lastName) {
    await clerk.users.updateUser(user.id, {
      firstName: account.firstName,
      lastName: account.lastName,
    });
  }

  const { token } = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60,
  });
  return NextResponse.redirect(demoTicketUrl(env.APP_URL, as, locale, token));
}

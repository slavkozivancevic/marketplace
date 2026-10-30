import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { env } from "@/env/server";
import { asLocale } from "@/i18n/config";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimitResponse } from "@/lib/rateLimit/guard";
import { DEMO_ACCOUNTS, isDemoRole, isVisitorBuyerEmail } from "@/features/demo/demoAccounts";
import { createDemoBuyer, retireDemoBuyers } from "@/features/demo/demoBuyers";
import { demoLandingPath, demoTicketUrl } from "@/features/demo/demoSignIn";
import { repairDemoAccount } from "@/features/demo/repairDemoAccount";
import { prisma } from "@/core/db/prisma";

/**
 * GET /api/demo/sign-in?as=buyer|seller|admin[&locale=sr]
 *
 * One-click sign-in for the public demo accounts linked from the README and
 * the showcase page. Mints a 60-second Clerk sign-in token and sends the
 * browser to the sign-in page, which redeems it and lands on the account's
 * home screen. The accounts have no password, so there is nothing a visitor
 * can change to lock the next one out.
 *
 * The seller and the admin are shared and view-only. The buyer is made fresh
 * for each visitor (see demoBuyers.ts), so nobody sees someone else's cart,
 * orders or chat.
 *
 * What each account may do is enforced elsewhere - see demoAccounts.ts. This
 * route also undoes whatever the last visitor changed in Clerk's profile
 * screen - see repairDemoAccount.
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
  const clerk = await clerkClient();
  let userId: string | undefined;

  if (as === "buyer") {
    // Already one of our visitor buyers - say a second click on the showcase -
    // keeps the same cart and orders instead of starting over.
    const { userId: sessionUserId } = await auth();
    if (sessionUserId) {
      const current = await prisma.user.findUnique({
        where: { clerkUserId: sessionUserId },
        select: { email: true, deletedAt: true },
      });
      if (current && !current.deletedAt && isVisitorBuyerEmail(current.email)) {
        return NextResponse.redirect(new URL(demoLandingPath("buyer", locale), env.APP_URL));
      }
    }

    const tooMany = await rateLimitResponse("demoBuyer", await getClientIp());
    if (tooMany) return tooMany;
    await retireDemoBuyers().catch((err: unknown) =>
      logger.error("[demo] retiring visitor buyers failed", err),
    );
    userId = await createDemoBuyer();
  } else {
    const account = DEMO_ACCOUNTS[as];
    // Our DB first: its copy of the demo email cannot be changed from Clerk
    // (see syncedEmail), so it still finds the account after a visitor has
    // removed the address in Clerk's profile, where the email lookup would
    // come up empty.
    const stored = await prisma.user.findFirst({
      where: { email: account.email, deletedAt: null },
      select: { clerkUserId: true },
    });
    userId =
      stored?.clerkUserId ??
      (await clerk.users.getUserList({ emailAddress: [account.email] })).data[0]?.id;
    if (!userId) {
      return NextResponse.json(
        { error: true, message: "Demo accounts are not set up on this stage" },
        { status: 503 },
      );
    }
    await repairDemoAccount(clerk, userId, account);
  }

  const { token } = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 60,
  });
  return NextResponse.redirect(demoTicketUrl(env.APP_URL, as, locale, token));
}

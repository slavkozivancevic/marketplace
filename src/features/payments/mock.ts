import "server-only";
import { env } from "@/env/server";

/**
 * Simulate Stripe Connect locally - no real connected account, IBAN, or
 * transfer call. Explicit env wins; otherwise mock is on everywhere except
 * production so local dev is never blocked by Connect's real bank requirements.
 */
export const MOCK_CONNECT =
  env.MOCK_STRIPE_CONNECT === "true" ||
  (env.MOCK_STRIPE_CONNECT === undefined &&
    process.env.NODE_ENV !== "production");

/** A connected account created by the mock onboarding path. */
export function isMockAccount(stripeAccountId: string): boolean {
  return stripeAccountId.startsWith("acct_mock_");
}

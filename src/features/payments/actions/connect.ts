"use server";

import { cookies } from "next/headers";
import { stripe } from "@/services/stripe";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { getPathname } from "@/i18n/navigation";
import { asLocale } from "@/i18n/config";
import { getConnectedAccount } from "../db/connectedAccount";
import { MOCK_CONNECT, isMockAccount } from "../mock";
import type { ActionErrorResult } from "@/types/types";

export type ConnectStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

const DISCONNECTED: ConnectStatus = {
  connected: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
};


/**
 * Creates (or reuses) the org's Stripe Express account and returns a hosted
 * onboarding link. The client redirects the seller to `url`; Stripe sends them
 * back to the payouts page where status is re-synced.
 */
export async function startConnectOnboarding(): Promise<
  { url: string } | ActionErrorResult
> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "payout:manage");

    const cookieStore = await cookies();
    const locale = asLocale(cookieStore.get("NEXT_LOCALE")?.value);
    const returnPath = getPathname({
      href: "/dashboard/organization/payouts",
      locale,
    });

    // Mock mode: mark the org connected-and-enabled without touching Stripe, and
    // send the user straight back to the payouts page (which shows "Active").
    if (MOCK_CONNECT) {
      const existing = await getConnectedAccount(ctx.organizationId);
      const enabled = {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      };
      if (existing) {
        await prisma.connectedAccount.update({
          where: { id: existing.id },
          data: enabled,
        });
      } else {
        await prisma.connectedAccount.create({
          data: {
            organizationId: ctx.organizationId,
            stripeAccountId: `acct_mock_${ctx.organizationId}`,
            ...enabled,
          },
        });
      }
      // Relative path keeps the user on the current origin. The real flow below
      // needs an absolute URL for Stripe's redirect; mock has no Stripe redirect.
      return { url: returnPath };
    }

    let account = await getConnectedAccount(ctx.organizationId);
    if (!account) {
      const stripeAccount = await stripe.accounts.create({
        type: "express",
        // Separate charges + transfers: the platform takes the card payment, so
        // the connected account only needs the transfers capability to receive
        // its share. Requesting it drives the right onboarding requirements.
        capabilities: { transfers: { requested: true } },
        metadata: { organizationId: ctx.organizationId },
      });
      account = await prisma.connectedAccount.create({
        data: {
          organizationId: ctx.organizationId,
          stripeAccountId: stripeAccount.id,
        },
      });
    }

    const link = await stripe.accountLinks.create({
      account: account.stripeAccountId,
      refresh_url: `${env.APP_URL}${returnPath}`,
      return_url: `${env.APP_URL}${returnPath}`,
      type: "account_onboarding",
    });

    return { url: link.url };
  } catch (error) {
    console.error("[startConnectOnboarding]", error);
    return handleActionError(error);
  }
}

/**
 * Pulls the live account from Stripe and persists its charges/payouts/details
 * flags. Called when the payouts page loads (incl. on return from onboarding),
 * standing in for an account.updated webhook until one is wired.
 */
export async function syncConnectStatus(): Promise<
  ConnectStatus | ActionErrorResult
> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "payout:manage");

    const account = await getConnectedAccount(ctx.organizationId);
    if (!account) return DISCONNECTED;

    // Mock mode (or a mock account): trust the stored flags, skip Stripe.
    if (MOCK_CONNECT || isMockAccount(account.stripeAccountId)) {
      return {
        connected: true,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        detailsSubmitted: account.detailsSubmitted,
      };
    }

    const sa = await stripe.accounts.retrieve(account.stripeAccountId);
    const flags = {
      chargesEnabled: sa.charges_enabled ?? false,
      payoutsEnabled: sa.payouts_enabled ?? false,
      detailsSubmitted: sa.details_submitted ?? false,
    };
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: flags,
    });

    return { connected: true, ...flags };
  } catch (error) {
    console.error("[syncConnectStatus]", error);
    return handleActionError(error);
  }
}

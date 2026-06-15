import { prisma } from "@/core/db/prisma";

export type ConnectedAccountFlags = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export function getConnectedAccount(organizationId: string) {
  return prisma.connectedAccount.findUnique({ where: { organizationId } });
}

export function getConnectedAccountByStripeId(stripeAccountId: string) {
  return prisma.connectedAccount.findUnique({ where: { stripeAccountId } });
}

/** Persists the latest charges/payouts/details flags pulled from Stripe. */
export function syncConnectedAccountFlags(
  stripeAccountId: string,
  flags: ConnectedAccountFlags,
) {
  return prisma.connectedAccount.update({
    where: { stripeAccountId },
    data: flags,
  });
}

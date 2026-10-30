import type { clerkClient } from "@clerk/nextjs/server";
import type { DemoAccount } from "./demoAccounts";

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;

/** The slice of the Clerk backend client the repair uses - small enough to fake in a test. */
export type DemoRepairClerk = {
  users: Pick<
    ClerkClient["users"],
    "getUser" | "updateUser" | "deleteUserExternalAccount" | "disableUserMFA" | "deleteUserProfileImage"
  >;
  emailAddresses: Pick<
    ClerkClient["emailAddresses"],
    "createEmailAddress" | "updateEmailAddress" | "deleteEmailAddress"
  >;
};

/**
 * Puts a demo account back the way the demo needs it, before each sign-in.
 * Every visitor shares it and Clerk's profile screen is theirs to play with:
 * the next visitor must not find someone else's name, avatar, Google account
 * or address on it, and a second factor would stop the sign-in token at
 * `needs_second_factor`. The profile screen hides these for demo accounts, but
 * Clerk's frontend API is still one DevTools call away.
 *
 * Writes only what drifted, so a clean account costs one read. The email
 * order matters: the alias becomes primary first, because Clerk refuses to
 * delete a primary address, and external accounts go before addresses, since
 * an address can belong to one.
 *
 * Read-only does not depend on any of this - the stored email is anchored in
 * our DB (see syncedEmail) - this is about what the next visitor sees.
 */
export async function repairDemoAccount(
  clerk: DemoRepairClerk,
  userId: string,
  account: DemoAccount,
): Promise<void> {
  let user = await clerk.users.getUser(userId);

  if (user.firstName !== account.firstName || user.lastName !== account.lastName) {
    await clerk.users.updateUser(userId, {
      firstName: account.firstName,
      lastName: account.lastName,
    });
  }
  if (user.hasImage) await clerk.users.deleteUserProfileImage(userId);
  if (user.twoFactorEnabled) await clerk.users.disableUserMFA(userId);

  if (user.externalAccounts.length > 0) {
    for (const external of user.externalAccounts) {
      await clerk.users.deleteUserExternalAccount({ userId, externalAccountId: external.id });
    }
    // Clerk may have dropped the account's address along with it.
    user = await clerk.users.getUser(userId);
  }

  const alias = user.emailAddresses.find(
    (e) => e.emailAddress.trim().toLowerCase() === account.email,
  );
  if (!alias) {
    await clerk.emailAddresses.createEmailAddress({
      userId,
      emailAddress: account.email,
      verified: true,
      primary: true,
    });
  } else if (user.primaryEmailAddressId !== alias.id) {
    await clerk.emailAddresses.updateEmailAddress(alias.id, { primary: true });
  }
  for (const other of user.emailAddresses) {
    if (other !== alias) await clerk.emailAddresses.deleteEmailAddress(other.id);
  }
}

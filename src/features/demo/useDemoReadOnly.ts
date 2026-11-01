"use client";

import { useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import { isDemoReadOnlyEmail } from "./demoAccounts";

const noSubscription = () => () => {};

/**
 * Whether the signed-in user is the demo seller or the demo admin: one account
 * shared by every visitor, so it gets none of the buyer's actions (cart,
 * wishlist, checkout, chat). The server refuses them on its own; this only
 * lets the UI say so before the click. Same source as `DemoAvatarBadge`.
 *
 * False until hydration is over: the server render does not know the Clerk
 * user while the client's first render can, and a locked button rendered on
 * one side only fails hydration and regenerates the whole tree. The server
 * snapshot keeps both renders on "not locked"; the lock lands right after,
 * under the boot loader on a full load.
 */
export function useDemoReadOnly(): boolean {
  const { user } = useUser();
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return hydrated && isDemoReadOnlyEmail(user?.primaryEmailAddress?.emailAddress);
}

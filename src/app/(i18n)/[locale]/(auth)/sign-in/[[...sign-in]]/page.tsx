"use client";
import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { DemoSignInPanel } from "@/features/demo/components/DemoSignInPanel";

const SignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
  },
);

const subscribeNever = () => () => {};
const readHasTicket = () =>
  new URLSearchParams(window.location.search).has("__clerk_ticket");

export default function Page() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  // A demo link redeems a sign-in token here (see /api/demo/sign-in).
  const hasTicket = useSyncExternalStore(subscribeNever, readHasTicket, () => false);
  // Someone already signed in - say as the demo buyer, now trying the seller -
  // would have the ticket ignored: Clerk's <SignIn /> just redirects a signed-in
  // user. So that session ends first and the same URL loads again; the token is
  // good for a minute. <SignIn /> stays unmounted meanwhile, or its redirect
  // would win the race.
  const switching = hasTicket && (!isLoaded || isSignedIn);

  useEffect(() => {
    if (hasTicket && isLoaded && isSignedIn) {
      void signOut({ redirectUrl: window.location.href });
    }
  }, [hasTicket, isLoaded, isSignedIn, signOut]);

  return (
    <div className="flex w-full flex-col items-center gap-6 px-4 py-8">
      {!switching && <SignIn />}
      {!hasTicket && <DemoSignInPanel />}
    </div>
  );
}

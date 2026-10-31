"use client";

import { useEffect } from "react";
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import { AppLoader } from "@/components/layout/app-loader";

// The ticket being redeemed, at module scope so a remount (Strict Mode, or the
// same-URL navigation signOut ends with) cannot redeem it twice: a ticket is
// single-use, and the second attempt would fail and show the form.
let redeeming: string | null = null;

/** `redirect_url` only if it stays on this site, else the home page. */
function sameOriginTarget(raw: string | null): string {
  if (!raw) return "/";
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.href : "/";
  } catch {
    return "/";
  }
}

/**
 * Redeems a demo sign-in token (see /api/demo/sign-in) behind the boot loader,
 * so a demo link goes from click to the account's home screen with one steady
 * loader and no sign-in form. Clerk's `<SignIn />` can redeem `__clerk_ticket`
 * too, but it renders the card first and flashes it before redirecting.
 *
 * Someone already signed in - say as the demo buyer, now trying the seller - is
 * signed out first: Clerk refuses to start a sign-in inside an active session.
 * The landing page is a full load, so the server renders it with the new
 * session, and `replace` keeps the spent ticket URL out of history.
 */
export function DemoTicketSignIn({ onFailed }: { onFailed: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { signIn, setActive } = useSignIn();

  useEffect(() => {
    if (!isLoaded || !signIn) return;
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("__clerk_ticket");
    if (!ticket || redeeming === ticket) {
      // Signed in by our own redemption: setActive flips isSignedIn and runs
      // this effect again before the landing page loads. Signing out here
      // would end the session just created - on staging the page then landed
      // signed out.
      return;
    }
    if (isSignedIn) {
      void signOut({ redirectUrl: window.location.href });
      return;
    }
    redeeming = ticket;
    const target = sameOriginTarget(params.get("redirect_url"));

    void (async () => {
      try {
        const attempt = await signIn.create({ strategy: "ticket", ticket });
        if (attempt.status !== "complete" || !attempt.createdSessionId) {
          throw new Error(`Demo ticket sign-in ended as ${attempt.status}`);
        }
        await setActive({ session: attempt.createdSessionId });
        window.location.replace(target);
      } catch {
        // Expired (the token lives a minute) or already used, e.g. the page
        // came back from history. The caller shows the form and the panel.
        redeeming = null;
        onFailed();
      }
    })();
  }, [isLoaded, isSignedIn, signIn, setActive, signOut, onFailed]);

  return <AppLoader hidden={false} />;
}

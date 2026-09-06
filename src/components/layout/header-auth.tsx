"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { HeaderDivider } from "./header-divider";
import { cn } from "@/lib/utils";

interface HeaderAuthProps {
  mode?: "modal" | "redirect";
  showDashboardLink?: boolean;
  /**
   * Server-resolved auth state (from `auth()` in the layout). Renders the
   * correct branch in the SSR HTML (under the boot loader) until clerk-js
   * settles, so the auth controls don't pop in after the loader lifts.
   */
  signedIn?: boolean;
  /**
   * Renders just the avatar slot (or nothing, when signed out) instead of
   * the full sign-in/sign-up/dashboard controls - for a compact instance
   * that stays visible at widths where the full controls would overflow.
   * Pair with a sibling full `<HeaderAuth>` hidden at that same breakpoint
   * (and shown above it) so together they cover every width without ever
   * rendering the avatar twice.
   */
  avatarOnly?: boolean;
  /**
   * Suppresses the avatar for a signed-in visitor - the mirror image of
   * `avatarOnly`. For an instance living inside a mobile dropdown/panel
   * alongside a sibling `avatarOnly` instance that's already always visible
   * in the header row: the dropdown still needs to offer sign-in/sign-up to
   * a signed-out visitor, but showing the avatar there too would duplicate
   * the one already visible outside the dropdown.
   */
  hideAvatarWhenSignedIn?: boolean;
  /**
   * How the sign-in/sign-up pair is laid out.
   *
   * `row` (default) is the header rail: the pair sits on the icon rail's own
   * 8px rhythm behind a `<HeaderDivider>`, which is rendered as part of the
   * signed-out branch so it shows up with the buttons and never next to a
   * lone avatar. The rule marks the boundary and the spacing ratio backs it
   * up - 8px inside the pair against 12px either side of the rule.
   *
   * `panel` is the mobile dropdown: the two buttons split the row evenly
   * (`flex-1`) so they read as one block aligned with the nav rows above,
   * capped at `max-w-lg` so a wide dropdown (tablet, landscape phone) never
   * stretches them into two banners.
   */
  layout?: "row" | "panel";
}

/**
 * Renders Clerk's auth UI in the header.
 *
 * Gated behind a `mounted` flag: Clerk renders the `<SignedIn>`/`<UserButton>`
 * branch on the server (it has the session from middleware) but its client
 * host element doesn't match on the first client render before clerk-js loads,
 * producing a hydration mismatch. Rendering nothing until mounted keeps server
 * and first-client renders identical. The visual flash is separately hidden by
 * the full-page `<ClerkGate>` loader, which stays up until Clerk is ready.
 */
export function HeaderAuth({
  mode = "modal",
  showDashboardLink = false,
  signedIn = false,
  avatarOnly = false,
  hideAvatarWhenSignedIn = false,
  layout = "row",
}: HeaderAuthProps) {
  const panel = layout === "panel";
  const t = useTranslations("auth");
  const locale = useLocale();
  // After Clerk completes auth, send the user to the same-locale home page
  // rather than `/` (the env default) so middleware doesn't have to do a
  // second locale-resolution redirect. UserButton's sign-out target uses
  // the same logic for symmetry.
  const localeHome = `/${locale}`;

  const { isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const signedOutUI = (
    <>
      {/* The divider belongs to the buttons, not to the header, so it lives
          in this branch: it appears exactly when sign-in/sign-up do and is
          gone for a signed-in visitor, where there is only an avatar and
          nothing to divide off. `mr-1` on top of the row's gap-2 puts 12px
          on this side to match the 12px the caller's ml-1 puts on the other,
          so the rule sits centered in its own gutter. */}
      {!panel && <HeaderDivider className="mr-1" />}
      <SignInButton
        mode={mode}
        fallbackRedirectUrl={localeHome}
        signUpFallbackRedirectUrl={localeHome}
      >
        <Button variant="outline" className={cn(panel && "flex-1")}>
          {t("signIn")}
        </Button>
      </SignInButton>
      <SignUpButton
        mode={mode}
        fallbackRedirectUrl={localeHome}
        signInFallbackRedirectUrl={localeHome}
      >
        <Button className={cn(panel && "flex-1")}>{t("signUp")}</Button>
      </SignUpButton>
    </>
  );

  const dashboardLink = showDashboardLink && (
    <Link href="/dashboard" className="text-sm">
      {t("dashboard")}
    </Link>
  );

  // Both the placeholder and the real avatar live inside this same fixed-size
  // slot, so swapping one for the other can't shift sibling layout no matter
  // what dimensions Clerk's internal markup settles on. The UserButton's own
  // boxes are pinned to fill the slot so its avatar lands exactly where the
  // placeholder was.
  const avatarSlot = "size-8 shrink-0";
  const signedInUI = (
    <>
      {dashboardLink}
      {/* Sign-out target is set globally on `<ClerkProvider>` (the
          per-component `afterSignOutUrl` was deprecated). */}
      <div className={cn(avatarSlot, "flex items-center justify-center")}>
        <UserButton
          appearance={{
            elements: {
              rootBox: "size-8",
              userButtonBox: "size-8",
              // CSS objects (not classes): Clerk's internal styles win over
              // appended class names, which left the avatar at its 28px
              // default, LEFT-aligned inside the 32px trigger - so Clerk's
              // own focus ring (a gray circle in light mode) sat visibly
              // off-center from the avatar. The avatar now fills the trigger
              // exactly, and the mouse-click ring is dropped entirely
              // (opening the menu is feedback enough); keyboard focus gets
              // the app's own ring tokens so it's visible on every theme.
              userButtonTrigger: {
                width: "2rem",
                height: "2rem",
                borderRadius: "9999px",
                "&:focus": { boxShadow: "none" },
                "&:focus-visible": {
                  boxShadow:
                    "0 0 0 3px color-mix(in oklab, var(--color-ring) 50%, transparent)",
                },
              },
              avatarBox: { width: "2rem", height: "2rem" },
            },
          }}
        />
      </div>
    </>
  );

  // Placeholder for the signed-in case before clerk-js renders. `<UserButton>`
  // mounts a Clerk host `<div data-clerk-component>` that never matches the
  // server HTML, so SSR-ing it directly throws a hydration mismatch. This
  // plain circle is identical on both sides (no mismatch) and sits in the same
  // fixed slot as the real avatar, so the swap - which happens under the boot
  // loader the instant Clerk loads - produces no layout shift.
  const signedInPlaceholder = (
    <>
      {dashboardLink}
      <div className={cn(avatarSlot, "flex items-center justify-center")}>
        <div className="size-8 rounded-full bg-muted animate-pulse" aria-hidden />
      </div>
    </>
  );

  // Until clerk-js has loaded, render the branch the server already resolved
  // (`signedIn` prop) so SSR and the first client render agree - the controls
  // ship in the initial HTML under the boot loader and don't pop in after.
  // Once Clerk is loaded its <SignedIn>/<SignedOut> become authoritative.
  const clerkReady = mounted && isLoaded;

  // `avatarOnly` has nothing to show for a signed-out visitor - the sign-in/
  // sign-up buttons stay exclusive to the full `<HeaderAuth>` instance a
  // caller renders at wider widths.
  const effectiveSignedOutUI = avatarOnly ? null : signedOutUI;
  // `hideAvatarWhenSignedIn` is the mirror case: a signed-in visitor already
  // has the avatar from a sibling `avatarOnly` instance, so this one has
  // nothing left to show.
  const effectiveSignedInUI = hideAvatarWhenSignedIn ? null : signedInUI;
  const effectiveSignedInPlaceholder = hideAvatarWhenSignedIn
    ? null
    : signedInPlaceholder;

  // gap-2, not gap-4: the header rail spaces its own icons `gap-1 sm:gap-2`,
  // so a 16px gap here left sign-in and sign-up further apart from each other
  // than either was from the cart icon beside them - the pair read as two
  // unrelated controls. At 8px inside and 12px out to the caller's divider
  // the ratio is the right way round and they read as one cluster.
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        panel && "w-full max-w-lg",
      )}
    >
      {clerkReady ? (
        <>
          <SignedOut>{effectiveSignedOutUI}</SignedOut>
          <SignedIn>{effectiveSignedInUI}</SignedIn>
        </>
      ) : signedIn ? (
        effectiveSignedInPlaceholder
      ) : (
        effectiveSignedOutUI
      )}
    </div>
  );
}
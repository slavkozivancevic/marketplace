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
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

interface HeaderAuthProps {
  mode?: "modal" | "redirect";
  showDashboardLink?: boolean;
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
}: HeaderAuthProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  // After Clerk completes auth, send the user to the same-locale home page
  // rather than `/` (the env default) so middleware doesn't have to do a
  // second locale-resolution redirect. UserButton's sign-out target uses
  // the same logic for symmetry.
  const localeHome = `/${locale}`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-4" aria-hidden suppressHydrationWarning />
    );
  }

  return (
    <div className="flex items-center gap-4">
      <SignedOut>
        <SignInButton
          mode={mode}
          fallbackRedirectUrl={localeHome}
          signUpFallbackRedirectUrl={localeHome}
        >
          <Button variant="outline">{t("signIn")}</Button>
        </SignInButton>
        <SignUpButton
          mode={mode}
          fallbackRedirectUrl={localeHome}
          signInFallbackRedirectUrl={localeHome}
        >
          <Button>{t("signUp")}</Button>
        </SignUpButton>
      </SignedOut>

      <SignedIn>
        {showDashboardLink && (
          <Link href="/dashboard" className="text-sm">
            {t("dashboard")}
          </Link>
        )}
        {/* Sign-out target is set globally on `<ClerkProvider>` (the
            per-component `afterSignOutUrl` was deprecated). */}
        <UserButton />
      </SignedIn>
    </div>
  );
}
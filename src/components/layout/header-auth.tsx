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
 * Renders Clerk's auth UI in the header. Wrapped in a `mounted` guard
 * because Clerk's `<SignInButton>` / `<SignUpButton>` use
 * `React.cloneElement` to inject an `onClick` modal-opener onto their
 * child `<Button>` ONLY after the Clerk client SDK has loaded. On a cold
 * dev start the server-side render and the client-side first render don't
 * agree on those cloned props, which produces the exact hydration
 * mismatch React was reporting against the Sign-In button.
 *
 * Until the client mounts, we render a stable placeholder with the same
 * outer dimensions, so server and first-client renders match and there's
 * no visible layout shift when the real auth controls swap in.
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
    // Placeholder reserves the same visual footprint as the real controls
    // so neither layout shift nor a hydration diff fires.
    return (
      <div
        className="flex items-center gap-4"
        aria-hidden
        suppressHydrationWarning
      />
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
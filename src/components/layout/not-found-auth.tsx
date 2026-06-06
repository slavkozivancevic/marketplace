"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "lucide-react";

/**
 * Auth controls for the 404 page. Mirrors HeaderAuth visually but never
 * routes through Clerk's own navigation: from a not-found boundary every
 * soft navigation (Clerk's post-sign-in / post-sign-out redirect) re-renders
 * inside the broken boundary and crashes ("Rendered more hooks..."). So:
 *
 *   - sign-in / sign-up are plain links (full page load, no modal whose
 *     success-redirect would soft-navigate),
 *   - sign-out clears the session and hard-navigates itself, never letting
 *     Clerk's redirect run in this boundary.
 *
 * Same `mounted` + <Signed*> guard as HeaderAuth to avoid a hydration diff
 * on cold start (server hasn't resolved the session yet, client has).
 */
export function NotFoundAuth() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="flex items-center gap-2"
        aria-hidden
        suppressHydrationWarning
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <Button variant="outline" asChild>
          <a href={`/${locale}/sign-in`}>{t("signIn")}</a>
        </Button>
        <Button asChild>
          <a href={`/${locale}/sign-up`}>{t("signUp")}</a>
        </Button>
      </SignedOut>
      <SignedIn>
        <UserMenu />
      </SignedIn>
    </div>
  );
}

function UserMenu() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { user } = useUser();
  const { signOut } = useClerk();

  function handleSignOut() {
    // Pass a callback to signOut: Clerk runs IT after clearing the session
    // instead of performing its own (soft) redirect. That soft navigation is
    // what re-renders the not-found boundary and crashes ("Rendered more
    // hooks"); replacing it with our own hard navigation sidesteps the crash
    // entirely while still completing the network sign-out first.
    void signOut(() => {
      window.location.assign(`/${locale}`);
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="group relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <User className="size-3.5" />
          )}
          {/* Diagonal gloss sweep on hover - mimics Clerk's avatar shine.
              A thin 45deg highlight (oriented bottom-left -> top-right, i.e.
              "/") slides across the image and reverses on leave. The narrow
              gradient stops keep it a fine line; overflow-hidden clips it to
              the circle. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(135deg,transparent_47%,rgba(255,255,255,0.85)_50%,transparent_53%)] blur-[1px] transition-transform duration-200 ease-out group-hover:translate-x-full"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/dashboard">{t("dashboard")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

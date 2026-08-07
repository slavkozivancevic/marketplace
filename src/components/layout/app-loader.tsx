"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LoaderVisual } from "./loader-visual";

const STUCK_MS = 10_000;

/**
 * Gates the whole app behind a full-page boot loader until Clerk has resolved
 * the auth state on the client. Without this the header's auth controls (and
 * anything else reading Clerk) flash/shift in as the SDK loads.
 *
 * The overlay starts visible on both server and first client render (driven by
 * a `mounted` flag, not by Clerk's `isLoaded` which differs across the SSR
 * boundary), so there's no hydration mismatch. Once mounted AND Clerk is
 * loaded it fades out and unmounts, revealing the page underneath.
 */
export function ClerkGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const ready = mounted && isLoaded;

  return (
    <>
      {children}
      <AppLoader hidden={ready} />
    </>
  );
}

/**
 * Full-page branded loader. Used both for the initial Clerk boot gate and as
 * the overlay while switching organizations (a global tenant-context change).
 * The 500ms opacity fade-in doubles as a debounce: a fast switch barely shows
 * it, a slow one reveals the full loader.
 */
export function AppLoader({ hidden }: { hidden: boolean }) {
  // Keep the overlay mounted through the fade-out, then remove it so the
  // spinner stops animating off-screen.
  const [gone, setGone] = useState(false);
  const t = useTranslations("common");

  useEffect(() => {
    if (!hidden) {
      // Re-show the overlay if it becomes visible again before it was removed
      // (sync reset of the delayed-unmount flag - intentional, not derivable).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGone(false);
      return;
    }
    const id = setTimeout(() => setGone(true), 600);
    return () => clearTimeout(id);
  }, [hidden]);

  // Safety net: normally this overlay lifts within a second or two (Clerk
  // boot, org switch). If it's still up after STUCK_MS, something hung
  // upstream (a Clerk handshake hiccup, a stuck navigation, ...) - offer a
  // manual reload instead of leaving the user stuck forever. See the
  // 2026-08-06 staging incident: a post-2FA sign-in never lifted this loader
  // and only a hard reload recovered.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (hidden) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStuck(false);
      return;
    }
    const id = setTimeout(() => setStuck(true), STUCK_MS);
    return () => clearTimeout(id);
  }, [hidden]);

  if (gone) return null;

  return (
    <div
      aria-hidden={hidden}
      role="status"
      className={cn(
        "fixed inset-0 z-100 grid place-items-center bg-background transition-opacity duration-500 ease-out",
        hidden && "pointer-events-none opacity-0"
      )}
    >
      <LoaderVisual />
      {stuck && (
        <div className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-2 px-4 text-center">
          <p className="text-sm text-muted-foreground">{t("stuckMessage")}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4"
          >
            {t("reloadPage")}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { LoaderVisual } from "./loader-visual";

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
    </div>
  );
}

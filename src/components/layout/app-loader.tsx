"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_IMAGE_URL } from "./hero-image";

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

function AppLoader({ hidden }: { hidden: boolean }) {
  const t = useTranslations("header");
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
      {/* Same faint, theme-aware backdrop image as the rest of the app. */}
      <div className="page-background">
        <Image
          src={HERO_IMAGE_URL}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          unoptimized
        />
      </div>

      <div className="flex flex-col items-center gap-8">
        {/* Spinning gradient ring orbiting the brand mark */}
        <div className="relative h-24 w-24">
          <div className="app-loader-ring absolute inset-0 animate-spin rounded-full animation-duration-[1s]" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 animate-pulse">
              <Store className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Brand name + bouncing dots */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {t("brand")}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.15s]" />
            <span className="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.3s]" />
          </div>
        </div>
      </div>
    </div>
  );
}

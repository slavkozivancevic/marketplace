"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { syncUserLocale } from "@/actions/syncUserLocale";

// Retry schedule (ms) for the post-signup race where Clerk's user.created
// webhook hasn't yet inserted the User row into our DB. Total ceiling is
// ~9.5s which comfortably covers webhook processing in normal conditions
// without busy-spinning the action endpoint.
const RETRY_DELAYS_MS = [500, 1500, 3000, 5000];

/**
 * Mirrors the current request locale into User.locale for signed-in users.
 * Runs once per locale change (the [locale] layout re-mounts on switch, so a
 * mount-level effect is enough). Covers two cases:
 *
 *   - User signs up mid-session in a non-default locale and never clicks
 *     the switcher - their stored preference would otherwise stay at the
 *     schema default ("en").
 *   - First-render-after-signup race: the Clerk webhook runs server-to-
 *     server and may not have inserted the User row by the time this
 *     effect fires. When `updateMany` returns count=0 we retry on a short
 *     backoff so the locale lands as soon as the row exists.
 *
 * Anonymous visitors are skipped. Idempotent - the server action no-ops
 * when stored locale already matches.
 */
export function LocaleSync() {
  const locale = useLocale();
  const { isSignedIn, isLoaded } = useAuth();
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (lastSynced.current === locale) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const attempt = async (retryIndex: number) => {
      try {
        const { updated } = await syncUserLocale(locale);
        if (cancelled) return;

        if (updated) {
          lastSynced.current = locale;
          return;
        }

        // User row not in DB yet (Clerk webhook race). Schedule a retry
        // unless we've exhausted the backoff window.
        const nextDelay = RETRY_DELAYS_MS[retryIndex];
        if (nextDelay == null) return;
        timeoutId = setTimeout(() => {
          if (!cancelled) void attempt(retryIndex + 1);
        }, nextDelay);
      } catch (err) {
        logger.error("[locale-sync] failed", err);
      }
    };

    void attempt(0);

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [locale, isSignedIn, isLoaded]);

  return null;
}

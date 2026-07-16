"use client";

import { useEffect } from "react";
import { useStore } from "zustand";
import { localeSwitchOverlayStore } from "@/lib/i18n/localeSwitchOverlay";

/**
 * Arrival detector for the language-switch overlay. Renders NOTHING - the
 * overlay itself is a plain DOM node managed by `localeSwitchOverlayStore`
 * (see that module for why it must live outside React). This component only
 * decides WHEN the switch is truly over, and that takes three conditions:
 *
 *   1. `locale === target` - this instance is mounted under the new locale
 *      (the prop comes from the root layout's `[locale]` param).
 *   2. The app shell has real content. The switch passes through a commit
 *      where the suspended intl providers render a `null` fallback and
 *      `.app-shell` is EMPTY; the DOM is perfectly "quiet" there while the
 *      route compiles/streams, which fooled a quiet-only heuristic into
 *      dropping the overlay before the new page ever appeared.
 *   3. The DOM has stopped mutating for a beat - late-streamed RSC content
 *      and hydration repaint the page after the first commit; those must
 *      happen under the overlay.
 *
 * Caps guarantee the overlay always comes down: a post-arrival cap plus a
 * global failsafe for navigations that never arrive at the target locale.
 */
export function LocaleSwitchLoader({ locale }: { locale: string }) {
  const target = useStore(localeSwitchOverlayStore, (s) => s.target);

  useEffect(() => {
    if (!target || target !== locale) return;

    const QUIET_MS = 400;
    const ARRIVED_CAP_MS = 8000;
    const POLL_MS = 100;

    let lastMutation = performance.now();
    const observer = new MutationObserver(() => {
      lastMutation = performance.now();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const shellHasContent = () => {
      const shell = document.querySelector(".app-shell");
      return shell != null && shell.childElementCount > 0;
    };

    const done = () => {
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(cap);
      localeSwitchOverlayStore.getState().finish();
    };

    const poll = setInterval(() => {
      if (shellHasContent() && performance.now() - lastMutation > QUIET_MS) {
        done();
      }
    }, POLL_MS);
    const cap = setTimeout(done, ARRIVED_CAP_MS);

    return () => {
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(cap);
    };
  }, [target, locale]);

  // Global failsafe: a failed/aborted navigation (target never reached) must
  // never leave the overlay up. Generous because dev-mode compiles of the
  // destination route can legitimately take a while.
  useEffect(() => {
    if (!target) return;
    const id = setTimeout(
      () => localeSwitchOverlayStore.getState().finish(),
      20_000,
    );
    return () => clearTimeout(id);
  }, [target]);

  return null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { consumeLanguageSwitch } from "@/lib/i18n/localeSwitch";

/**
 * Tab state whose lifetime is "being on this page": it persists across a
 * language switch but resets to `defaultValue` on any other navigation.
 *
 * A plain `useState` already gives same-page persistence and resets when you
 * leave - the only thing it loses is the language switch, which remounts the
 * whole `[locale]` subtree. So we persist the value to sessionStorage on change
 * and, on mount, restore it only when the remount was caused by the locale
 * switcher (see `consumeLanguageSwitch`). A normal leave-and-return finds no
 * marker, drops the stored value, and starts on the default.
 */
export function useStickyTabState(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const [tab, setTab] = useState(defaultValue);
  // Decide once per real mount. A language switch is a fresh instance (new ref);
  // React 18 StrictMode's double-invoke reuses the instance and is skipped.
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current) return;
    decided.current = true;

    if (consumeLanguageSwitch()) {
      try {
        const stored = sessionStorage.getItem(key);
        if (stored && stored !== tab) setTab(stored);
      } catch {
        // ignore unavailable storage
      }
    } else {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (value: string) => {
    setTab(value);
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // sessionStorage can throw in private mode / when full - non-fatal.
    }
  };

  return [tab, set];
}

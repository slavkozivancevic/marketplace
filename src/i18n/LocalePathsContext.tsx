"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Locale } from "./config";

export type LocalePaths = Partial<Record<Locale, string>>;

type LocalePathsState = {
  paths: LocalePaths | null;
  setPaths: (paths: LocalePaths | null) => void;
};

const LocalePathsStateContext = createContext<LocalePathsState | null>(null);

/**
 * Why a host + publish split (not a plain Provider):
 *
 * The language switcher (`PreferencesPopover` in `PublicHeader`) is a
 * SIBLING of the page inside `(public)/layout.tsx`. A context written by
 * the page wouldn't reach the header above. The host therefore lives in
 * `InnerProviders`, ABOVE both the header and the page, and holds React
 * state. The page then publishes its per-locale URLs into that state via
 * `<PublishLocalePaths paths={...} />`, and the switcher reads them via
 * `useLocalePaths()`.
 *
 * Lifecycle: `PublishLocalePaths` sets paths on mount and clears on
 * unmount, so navigating off a slug-page (or to one that doesn't publish)
 * leaves the switcher with a clean `null` and it falls back to next-intl's
 * pattern-only swap (correct behavior for static routes).
 */
export function LocalePathsHost({ children }: { children: React.ReactNode }) {
  const [paths, setPaths] = useState<LocalePaths | null>(null);
  const value = useMemo(() => ({ paths, setPaths }), [paths]);
  return (
    <LocalePathsStateContext.Provider value={value}>
      {children}
    </LocalePathsStateContext.Provider>
  );
}

export function PublishLocalePaths({ paths }: { paths: LocalePaths }) {
  const ctx = useContext(LocalePathsStateContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setPaths(paths);
    return () => ctx.setPaths(null);
    // `paths` is a fresh object on each server render; depend on its
    // JSON shape rather than reference to avoid a setPaths/clear churn
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(paths)]);
  return null;
}

export function useLocalePaths(): LocalePaths | null {
  return useContext(LocalePathsStateContext)?.paths ?? null;
}

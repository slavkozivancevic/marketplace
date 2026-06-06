"use client";

import { createContext, useContext } from "react";

/**
 * Forces hard navigation for any anchor click inside it, and signals (via
 * `useHardNav()`) that descendants which navigate imperatively - i.e. through
 * the router rather than an `<a>` - should do the same.
 *
 * Next.js App Router has a long-standing limitation: client-side (soft)
 * navigation does NOT commit when triggered from a page rendered by
 * `notFound()` / `not-found.tsx`. The `<Link>` fires the RSC request but the
 * router stays on the 404 view, so every link (header nav, logo, "back home",
 * footer) appears dead. See vercel/next.js#64053 and related.
 *
 * Anchors: we intercept clicks in the capture phase - which runs before
 * next/link's bubble-phase handler - and turn them into a full page load. The
 * anchor already carries the correct localized href (next-intl's Link resolved
 * it), so `window.location` navigates accurately and rebuilds a clean router
 * state. Modified clicks (new tab), external/target links, and download links
 * are left alone.
 *
 * Router-driven controls (e.g. the language switch calls `router.replace`)
 * can't be caught that way - they bypass anchors entirely. Those read
 * `useHardNav()` and fall back to `window.location` themselves.
 */
const HardNavContext = createContext(false);

/** True when rendered inside a {@link HardNavBoundary} (e.g. the 404 page). */
export function useHardNav() {
  return useContext(HardNavContext);
}

export function HardNavBoundary({ children }: { children: React.ReactNode }) {
  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;
    if (anchor.origin !== window.location.origin) return;

    e.preventDefault();
    e.stopPropagation();
    window.location.assign(anchor.href);
  }

  return (
    <HardNavContext.Provider value={true}>
      <div onClickCapture={handleClickCapture}>{children}</div>
    </HardNavContext.Provider>
  );
}

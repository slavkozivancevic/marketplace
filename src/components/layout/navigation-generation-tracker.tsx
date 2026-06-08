"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { notifyPath } from "@/lib/navigation/navGeneration";

/**
 * Reports the current pathname to the navigation-generation store on every
 * change. Rendered inside `InnerProviders` so it is always mounted and lives in
 * the dynamic Suspense boundary (using `usePathname` in the static layout shell
 * trips a Blocking Route error under cacheComponents). Renders nothing.
 *
 * The store de-duplicates and counts changes itself (module-level `lastPath`), so
 * this component staying mounted or remounting doesn't matter.
 */
export function NavigationGenerationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    notifyPath(pathname);
  }, [pathname]);

  return null;
}

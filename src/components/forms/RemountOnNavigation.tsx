"use client";

import { Fragment, type ReactNode } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";

/**
 * Remounts its children on every real navigation, and only then.
 *
 * What it replaces: `key={crypto.randomUUID()}` on a client form inside a server
 * page. That was aimed at the right problem - Next's client Router Cache can
 * restore a page's form subtree on return with the user's unsaved edits still in
 * it - but a fresh key on every SERVER render also tears the form down whenever
 * a Server Action revalidates the page. The form is then destroyed in the middle
 * of its own save: the transition that was still running (the spinner, the
 * "saved" toast waiting on it) dies with the component, and the replacement
 * mounts as if nothing had happened. It is the same fix
 * {@link ProductFormView} already makes for the product form, generalized.
 *
 * The navigation-generation counter is stable while you stay on the page (a
 * `router.refresh()` keeps the same pathname, so it never bumps - no
 * refresh/remount loop) and bumps on every path change, including a return to
 * the same route, which `usePathname` alone cannot see.
 */
export function RemountOnNavigation({ children }: { children: ReactNode }) {
  const navGeneration = useNavigationGeneration();
  return <Fragment key={navGeneration}>{children}</Fragment>;
}

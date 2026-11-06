"use client";

import type { ComponentProps } from "react";

/**
 * A link to the one-click demo sign-in (`/api/demo/sign-in`) that REPLACES the
 * current page in history. A demo sign-in ends on a page of its own - the one
 * the visitor was on, or the role's home - so the page the click came from
 * (the sign-in panel, a "buyers only" notice) is spent: kept in history, Back
 * returned to it already signed in, and it painted its offers again before
 * moving on. A modified click (new tab, new window) keeps the browser's own
 * behaviour.
 */
export function DemoSignInLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.location.replace(href);
      }}
    />
  );
}

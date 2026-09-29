"use client";

import { Link } from "@/i18n/navigation";
import { useTouchHover, touchActiveAttr } from "@/hooks/useTouchHover";
import { BrandLockup } from "./brand-lockup";

/**
 * The brand lockup as a link home, with the comet reachable by touch.
 *
 * Every header and the footer render the same thing: a `.group` link to `/`
 * wrapping `<BrandLockup effect="hover">`, whose comet runs on `:hover`. A
 * touch screen has no hover, so the comet was unreachable there - this adds
 * the same touch-plus-small-swipe gesture the cards use, and the CSS in
 * globals.css keys the animation off `data-touch-active` alongside `:hover`.
 *
 * It lives in its own file rather than in `brand-lockup.tsx` because that one
 * has to stay hook-free: `<LoaderVisual>` renders it from a Server Component,
 * before Clerk and next-intl are available.
 */
export function BrandHomeLink({
  tagline,
  className = "group flex items-center min-w-0",
}: {
  /** Small line under the wordmark (each header's own strapline). */
  tagline?: React.ReactNode;
  className?: string;
}) {
  const { active, containerRef, touchProps } = useTouchHover();

  return (
    <Link
      href="/"
      ref={containerRef}
      {...touchProps}
      {...touchActiveAttr(active)}
      className={className}
    >
      <BrandLockup size="header" effect="hover" tagline={tagline} />
    </Link>
  );
}

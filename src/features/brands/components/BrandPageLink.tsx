"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { rememberBrandForPage } from "@/features/brands/brandPageHint";
import type { BrandHeaderSource } from "./BrandPageHeader";

/**
 * A link to a brand page that hands the brand to the page's loading state on
 * click (see `brandPageHint`), so the header is drawn for real instead of as
 * placeholders. For server-rendered lists; a client component can call
 * `rememberBrandForPage` from its own handler.
 */
export function BrandPageLink({
  slug,
  brand,
  className,
  children,
}: {
  slug: string;
  brand: BrandHeaderSource;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={{ pathname: "/brands/[slug]", params: { slug } }}
      className={className}
      onClick={() => rememberBrandForPage(slug, brand)}
    >
      {children}
    </Link>
  );
}

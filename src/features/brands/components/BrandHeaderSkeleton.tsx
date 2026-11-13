"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { Skeleton, SkeletonBreadcrumbs, SkeletonButton } from "@/components/ui/skeleton";
import { brandPageHint } from "@/features/brands/brandPageHint";
import { BrandPageHeader, brandHeaderProps } from "./BrandPageHeader";

function decode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/**
 * The brand page's header while the page loads. When the link that started
 * the navigation recorded the brand (`brandPageHint`), this is the real
 * <BrandPageHeader> - the description wraps where the page's will, at every
 * width and in every locale. Otherwise (a hard load, a typed URL) placeholders
 * shaped like the typical brand.
 */
export function BrandHeaderSkeleton() {
  const params = useParams<{ slug?: string }>();
  const locale = useLocale() as (typeof routing.locales)[number];
  const t = useTranslations("brands");
  const tCrumbs = useTranslations("breadcrumbs");

  const slug = params?.slug ? decode(params.slug) : null;
  const brand = slug ? brandPageHint(slug) : undefined;

  if (brand && slug) {
    return (
      <BrandPageHeader
        seo={false}
        {...brandHeaderProps({
          brand,
          slug,
          locale,
          labels: { home: tCrumbs("home"), brands: tCrumbs("brands"), back: t("publicBackToBrands") },
        })}
      />
    );
  }

  // The hero's box exactly: no gap between <Breadcrumbs> (own pb-1) and the
  // row below, a 64px logo, and h-8/h-5 rows pinning the title and
  // description bars to the real `text-2xl`/`text-sm` line boxes.
  return (
    <div className="shrink-0 px-6 pt-2 pb-4 mb-2 sticky-header-bg">
      <SkeletonBreadcrumbs segments={3} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
          <div className="space-y-0.5 min-w-0">
            <div className="flex h-8 items-center">
              <Skeleton className="h-6 w-48" />
            </div>
            {/* The description, one <p> in the real page. Its line count,
                measured across the catalogue at every width (2026-11-13):
                five on a phone, three up to ~700px, two up to 767px, three
                again from 768px (the button moves beside it) to ~830px, and
                two from 840px up. */}
            <div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-96 max-w-full" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-72 max-w-full" />
              </div>
              <div className="flex h-5 items-center min-[700px]:max-md:hidden min-[840px]:hidden">
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="flex h-5 items-center sm:hidden">
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="flex h-5 items-center sm:hidden">
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0">
          <SkeletonButton label={t("publicBackToBrands")} />
        </div>
      </div>
    </div>
  );
}

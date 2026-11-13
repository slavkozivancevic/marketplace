"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";
import { findCategoryBySlug } from "@/features/categories/utils/findBySlug";
import { useStorefrontCategoryTree } from "./StorefrontCategoryTree";
import { CategoryPageHeader, categoryHeaderProps } from "./CategoryPageHeader";

function decode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/**
 * The category page's header while the page loads. The layout's category tree
 * already holds everything the header shows - name, description, parent and
 * the subcategories - so when the slug is in it, this draws the real
 * <CategoryPageHeader> from it: every line wraps where the page's will, at
 * every width and in every locale, and the page lands without moving.
 *
 * A slug the tree does not have (a category with nothing to buy yet, which the
 * storefront tree prunes) falls back to placeholders shaped like a department.
 */
export function CategoryHeaderSkeleton() {
  const params = useParams<{ slug?: string }>();
  const locale = useLocale() as (typeof routing.locales)[number];
  const tree = useStorefrontCategoryTree();
  const t = useTranslations("categories");
  const tCrumbs = useTranslations("breadcrumbs");

  const slug = params?.slug ? decode(params.slug) : null;
  const found = tree && slug ? findCategoryBySlug(tree, slug) : null;

  if (found && slug) {
    return (
      <CategoryPageHeader
        seo={false}
        {...categoryHeaderProps({
          category: found.node,
          parent: found.parent,
          slug,
          locale,
          labels: { home: tCrumbs("home"), products: tCrumbs("products"), back: t("publicBackToShop") },
        })}
      />
    );
  }

  return (
    <div className="shrink-0 px-6 pt-2 pb-3 sticky-header-bg">
      <SkeletonBreadcrumbs segments={3} />
      <SkeletonPageHeader
        titleWidth="w-56"
        descriptionWidth="w-[32rem] max-w-full"
        descriptionLinesOnPhone={2}
        actions={<SkeletonButton label={t("publicBackToShop")} />}
      />
      {/* A department's chips: 30px tall (`py-1.5` over a 16px `text-xs`
          line box plus the 1px border), `mt-2` under the header, `gap-2`
          apart; the last one hidden on a phone so the row wraps to two lines
          there, as most departments do. */}
      <div className="flex flex-wrap gap-2 mt-2">
        {["w-24", "w-40", "w-32", "w-20", "w-20", "w-28"].map((w, i, all) => (
          <Skeleton
            key={i}
            className={cn("h-7.5 rounded-full", w, i === all.length - 1 && "hidden sm:block")}
          />
        ))}
      </div>
    </div>
  );
}

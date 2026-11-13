import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { Footer } from "@/components/layout/footer";
import {
  Skeleton,
  SkeletonArray,
} from "@/components/ui/skeleton";

/**
 * Category directory skeleton.
 *
 * The header is the REAL `<PageHeader>` with the real strings - the titles are
 * static copy, so there is nothing to wait for and a placeholder bar there
 * would be a worse approximation than the text itself. Same call the brands
 * directory makes.
 *
 * Below it, each tile repeats the real one exactly: `rounded-lg border bg-card
 * p-3`, a square image box with `mb-2`, then a `text-sm` name (a 20px line box)
 * and a `text-xs` subcategory count under `mt-0.5` (a 16px box). The grid
 * repeats all four breakpoints, so the column count never changes under the
 * user as the real departments arrive.
 */
export default async function CategoriesDirectoryLoading() {
  const locale = await getLocale();
  const t = await getTranslations("categories");
  const tCrumbs = await getTranslations("breadcrumbs");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* Static copy, so the real trail. */}
        <Breadcrumbs
          items={[
            { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
            { name: tCrumbs("categories"), href: getPathname({ href: "/categories", locale }) },
          ]}
          seo={false}
        />
        <PageHeader
          title={t("directoryTitle")}
          description={t("directoryDescription")}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {/* Eight tiles - one per department in the catalogue. */}
            <SkeletonArray amount={8}>
              <div className="rounded-lg border bg-card p-3">
                <Skeleton className="mb-2 aspect-square w-full rounded" />
                {/* The real tile reserves two line boxes for the name and one
                    for the count (`min-h-[2lh]` / `min-h-[1lh]`), so every tile
                    is the same height at every width - the skeleton reserves
                    the same, or the grid would visibly grow when the names
                    arrive. `text-sm leading-snug` is 19.25px a line, `text-xs`
                    16px. */}
                <div className="min-h-[2lh] text-sm leading-snug">
                  <div className="flex h-lh items-center">
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                </div>
                <div className="mt-0.5 flex h-lh items-center text-xs">
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </SkeletonArray>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}

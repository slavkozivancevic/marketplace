import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { Skeleton, SkeletonArray } from "@/components/ui/skeleton";

/**
 * The brand directory. The trail, title and description are static copy, so
 * they are the real ones. Each tile mirrors the real card box for box
 * (measured 2026-11-13, 162px at every width): `p-6` and `gap-3` around the
 * 64px logo, then the name (`text-sm`, a 20px line box) directly over the
 * product count (`text-xs`, 16px) - no gap between the two lines.
 *
 * Sixteen tiles - the catalogue's brand count - so the footer starts where the
 * real one does instead of jumping up the screen on a desktop.
 */
export default async function BrandsLoading() {
  const locale = await getLocale();
  const t = await getTranslations("brands");
  const tCrumbs = await getTranslations("breadcrumbs");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs
          items={[
            { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
            { name: tCrumbs("brands"), href: getPathname({ href: "/brands", locale }) },
          ]}
          seo={false}
        />
        <PageHeader
          title={t("publicTitle")}
          description={t("publicDescription")}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <SkeletonArray amount={16}>
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card p-6">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="text-center">
                  <div className="flex h-5 items-center justify-center">
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <div className="flex h-4 items-center justify-center">
                    <Skeleton className="h-3 w-16" />
                  </div>
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

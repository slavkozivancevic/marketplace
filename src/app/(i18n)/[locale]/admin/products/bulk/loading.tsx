import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonBreadcrumbs } from "@/components/ui/skeleton";

/**
 * The page awaits brands, categories and tags together before it renders
 * anything, so without this the products list stayed frozen on screen for the
 * whole round-trip after clicking "Bulk operations".
 *
 * Mirrors <BulkProductsManager>: a four-tab TabsList over a
 * `rounded-lg border bg-card p-6` panel. TabsTrigger carries `flex-1` in its
 * base and the list is `w-full`, so all four tabs are the same width.
 *
 * The panel shows <ConditionalBulkPanel> in its INITIAL state, which is what
 * loads here - a `max-w-3xl` column of three `gap-3` sections (conditions,
 * action, preview), each headed by a `text-sm font-semibold` h3. There are no
 * condition rows yet, only the empty-state hint and the `size="sm"` add button.
 */
export default async function BulkProductsLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader title={t("admin.bulkTitle")} description={t("admin.bulkDesc")}>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/products">{t("admin.backToProducts")}</Link>
          </Button>
        </PageHeader>
      </div>

      {/* `gap-2`: the real <Tabs> root is `flex flex-col gap-2`, so the panel
          sits 8px + its own `mt-3` under the tab list. */}
      <div className="flex-1 flex flex-col min-h-0 gap-2 px-6 pb-6">
        <div className="shrink-0 flex w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-0.75">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7.75 flex-1 rounded-md" />
          ))}
        </div>

        <div className="flex-1 min-h-0 mt-3 overflow-y-auto rounded-lg border bg-card p-6">
          {/* Measured against the loaded panel: each text line sits in its
              real line box (h-5 for text-sm, h-4 for text-xs), and the three
              sections are split by <Separator>s, as in the real panel. */}
          <div className="flex flex-col gap-6 max-w-3xl">
            {/* Conditions: heading, empty-state hint, "Add condition". */}
            <div className="flex flex-col gap-3">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-80 max-w-full" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-96 max-w-full" />
              </div>
              {/* variant="outline" size="sm" w-fit -> h-7. */}
              <Skeleton className="h-7 w-33 rounded-lg" />
            </div>

            <div className="h-px w-full bg-border" />

            {/* Action: heading, then the action select and the status select
                its default action brings, each a `text-xs` label over it. */}
            <div className="flex flex-col gap-3">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-36" />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <Skeleton className="h-8 w-60 rounded-lg" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-44 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-border" />

            {/* Preview & execute: heading, the preview button with its hint,
                then the `text-xs` note under them. */}
            <div className="flex flex-col gap-3">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-44" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-7 w-60 rounded-lg" />
                <Skeleton className="h-3.5 w-44" />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-[28rem] max-w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

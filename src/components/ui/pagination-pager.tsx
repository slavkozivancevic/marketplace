"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "./button";

/**
 * Simple prev / next pager for SSR-paginated lists. Renders as `<Link>`s
 * so crawlers can follow them (with `rel="prev"`/`"next"` hints for the
 * paging signal) and so back/forward navigation hits cached pages.
 *
 * The pager preserves any existing query params on the current URL so
 * combining it with filter state (e.g. category-internal filters added
 * later) just works.
 */
export function PaginationPager({
  currentPage,
  pageCount,
  total,
}: {
  currentPage: number;
  pageCount: number;
  total: number;
}) {
  const t = useTranslations("pagination");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  const makeHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    // Pathname comes from i18n's typed router so it's already locale-
    // aware. The query string round-trips via the standard hook.
    return {
      pathname: pathname as never,
      query: qs
        ? Object.fromEntries(new URLSearchParams(qs).entries())
        : undefined,
    };
  };

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < pageCount;

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="flex items-center justify-between border-t border-border/40 pt-4 mt-6"
    >
      <p className="text-xs text-muted-foreground">
        {t("pageOfWithTotal", { current: currentPage, total: pageCount, count: total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          asChild={hasPrev}
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          aria-label={t("previous")}
        >
          {hasPrev ? (
            <Link href={makeHref(currentPage - 1)} rel="prev">
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </Link>
          ) : (
            <span className="opacity-50 inline-flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </span>
          )}
        </Button>
        <Button
          asChild={hasNext}
          variant="outline"
          size="sm"
          disabled={!hasNext}
          aria-label={t("next")}
        >
          {hasNext ? (
            <Link href={makeHref(currentPage + 1)} rel="next">
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="opacity-50 inline-flex items-center gap-1">
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}

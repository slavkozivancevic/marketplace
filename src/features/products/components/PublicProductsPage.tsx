"use client";

import { useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getBrandName } from "@/features/brands/utils/translations";
import { useQueryStates } from "nuqs";
import {
  productSearchParams,
  type ProductFilters,
} from "@/lib/query/searchParams";
import {
  FilterSidebar,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { PublicProductsGrid } from "./PublicProductsGrid";
import type { BrandOption } from "@/features/brands/components/BrandSelect";
import { DepartmentSearchBar } from "@/features/categories/components/DepartmentSearchBar";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import { getCategorySlug } from "@/features/categories/utils/translations";
import { useRouter } from "@/i18n/navigation";
import { useCurrencyStore } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";

/** Sheet close animation duration (see `data-closed:animate-out` +
 *  `transition duration-200` in `components/ui/sheet`). The dept-change
 *  navigation waits this long so the drawer is fully closed/unmounted before
 *  the route commit, avoiding a slide-out animation restart ("flash"). A small
 *  buffer over 200ms covers timing jitter. */
const SHEET_CLOSE_MS = 220;

/** Finds a category node by any locale's slug (the dept selector emits the
 *  default-locale slug, but we resolve robustly regardless of which one). */
function findDeptNodeBySlug(
  tree: CategoryTreeItem[],
  slug: string,
): CategoryTreeItem | null {
  for (const node of tree) {
    if (node.translations.some((tr) => tr.slug === slug)) return node;
    const found = findDeptNodeBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

/**
 * Universal product catalog used by `/products`, `/brands/[slug]` and
 * `/categories/[slug]`.
 *
 *   - `lockedBrandId`  set by `/brands/[slug]` -> brand filter is removed
 *     from the sidebar and the brand-id is force-merged into every query
 *     against `/api/products`. NOT persisted to the URL (owned by the route).
 *   - `currentDept`    set by `/categories/[slug]` -> the department this
 *     page is scoped to. The department selector stays fully visible and
 *     pre-selects this dept; the page behaves exactly like `/products` but
 *     pre-filtered. Department is path-based, so changing it navigates to
 *     the chosen department's page rather than toggling a query param.
 */
export function PublicProductsPage({
  brands = [],
  categoryTree = [],
  footer,
  lockedBrandId,
  currentDept,
}: {
  brands?: BrandOption[];
  categoryTree?: CategoryTreeItem[];
  footer?: React.ReactNode;
  lockedBrandId?: string;
  currentDept?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  // Department lives in the path (`/categories/[slug]`), so switching it is a
  // navigation: pick a dept -> its page, "All" -> the full catalog. Resolving
  // the node lets us emit the locale-correct slug for the target URL.
  //
  // The selector opens a Radix Sheet. Navigating while the Sheet is still
  // animating closed has two problems: (1) it can leave `pointer-events: none`
  // stuck on <body>, and (2) the route commit re-renders the portaled, mid-exit
  // SheetContent and restarts its slide-out animation - the drawer visibly pops
  // back open and slides out again. Defer the push until the close animation
  // finishes and the Sheet content has unmounted, so there is nothing left to
  // disturb. Must stay >= the Sheet's close animation duration (200ms).
  const handleDeptChange = (slug: string) => {
    const navigate = () => {
      if (!slug) {
        router.push("/products");
        return;
      }
      const node = findDeptNodeBySlug(categoryTree, slug);
      const localizedSlug = node ? getCategorySlug(node, locale) : slug;
      router.push({
        pathname: "/categories/[slug]",
        params: { slug: localizedSlug },
      });
    };
    setTimeout(navigate, SHEET_CLOSE_MS);
  };
  const { currency } = useCurrencyStore();
  const currencySymbol = getCurrencyConfig(currency).symbol;

  // "title" sort dropped when title moved to ProductTranslation.
  const SORT_OPTIONS = [
    { value: "createdAt", label: t("products.dateAdded") },
    { value: "price", label: t("products.price") },
    { value: "avgRating", label: t("products.rating") },
  ];

  const [params, setParams] = useQueryStates(productSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Bypass nuqs's internal pending-queue cache for the user-typed `search` field:
  // it can leak across navigation (queue is a global singleton). Read directly
  // from the URL so navigating to a clean URL always starts empty.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";

  // ---- Filter groups ----
  const filterGroups: FilterGroup[] = useMemo(() => {
    const groups: FilterGroup[] = [
      {
        type: "range",
        key: "price",
        label: t("products.price"),
        prefix: currencySymbol,
        min: 0,
        step: 1,
      },
      {
        type: "rating",
        key: "minRating",
        label: t("search.customerReviews"),
      },
      {
        type: "checkbox",
        key: "onSale",
        label: t("products.deals"),
        options: [{ value: "true", label: t("products.onSale") }],
      },
      {
        type: "checkbox",
        key: "isDigital",
        label: t("products.productType"),
        options: [
          { value: "false", label: t("products.physical") },
          { value: "true", label: t("products.digital") },
        ],
      },
    ];

    // Hide the brand filter when the page already pins it (brand storefront).
    if (brands.length > 0 && !lockedBrandId) {
      groups.push({
        type: "checkbox",
        key: "brandId",
        label: t("products.brand"),
        options: brands.map((b) => ({ value: b.id, label: getBrandName(b, locale) })),
        maxVisible: 5,
      });
    }

    return groups;
  }, [brands, lockedBrandId, t, currencySymbol, locale]);

  // ---- Filter values ----
  // URL stores values as typed by user (in selected currency) - no conversion, no rounding.
  const filterValues: FilterValues = {
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    minRating: params.minRating ?? null,
    onSale: params.onSale === true ? ["true"] : [],
    isDigital: params.isDigital != null ? [String(params.isDigital)] : [],
    brandId: params.brandId,
  };

  // ---- Handlers ----
  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
    if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    } else if (key === "minRating") {
      setParams({ minRating: (value as number | null) ?? null });
    } else if (key === "onSale") {
      const vals = value as string[];
      setParams({ onSale: vals.includes("true") ? true : null });
    } else if (key === "isDigital") {
      const vals = value as string[];
      if (vals.length === 0 || vals.length === 2) setParams({ isDigital: null });
      else setParams({ isDigital: vals[0] === "true" });
    } else if (key === "brandId") {
      setParams({ brandId: value as string[] });
    }
  };

  const handleFilterClear = () => {
    setParams({
      minPrice: null,
      maxPrice: null,
      onSale: null,
      isDigital: null,
      brandId: [],
      minRating: null,
    });
  };

  const handleFilterRemove = (key: string) => {
    if (key === "price") setParams({ minPrice: null, maxPrice: null });
    else if (key === "minRating") setParams({ minRating: null });
    else if (key === "onSale") setParams({ onSale: null });
    else if (key === "isDigital") setParams({ isDigital: null });
    else if (key === "brandId") setParams({ brandId: [] });
  };

  const filters: ProductFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    // Raw display-currency values - buildFetcher converts to USD at fetch time.
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    onSale: params.onSale,
    isDigital: params.isDigital,
    // Locked dimensions take precedence so the visitor can't unlock the
    // brand storefront / category page via URL tampering.
    brandId: lockedBrandId ? [lockedBrandId] : params.brandId,
    minRating: params.minRating,
    dept: currentDept ?? params.dept,
  };

  const outerScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Search bar - shrink-0, ne skroluje */}
      <div className="flex flex-col gap-2 shrink-0 px-6">
        <DepartmentSearchBar
          tree={categoryTree}
          dept={currentDept ?? params.dept}
          onDeptChange={handleDeptChange}
          search={search}
          onSearchChange={(v) => setParams({ search: v })}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) => setParams({ sortBy: v as ProductFilters["sortBy"] })}
          onSortOrderChange={(v) => setParams({ sortOrder: v })}
          sortOptions={SORT_OPTIONS}
          filterGroups={filterGroups}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onFilterClear={handleFilterClear}
        />
        <ActiveFilters
          groups={filterGroups}
          values={filterValues}
          onRemove={handleFilterRemove}
          onClearAll={handleFilterClear}
        />
      </div>

      {/* Outer scroll container: sidebar + grid + footer */}
      <div ref={outerScrollRef} className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] flex flex-col">
        <div className="flex gap-6 flex-1 px-6">
          <FilterSidebar
            groups={filterGroups}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            sticky
          />
          <div className="flex-1 min-w-0">
            <PublicProductsGrid filters={filters} scrollContainerRef={outerScrollRef} />
          </div>
        </div>
        <div className="mt-8 pb-6">{footer}</div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { getBrandName } from "@/features/brands/utils/translations";
import { getTagName } from "@/features/tags/utils/translations";
import type { TagListItem } from "@/features/tags/db/tags";
import { getLabel } from "@/features/attributes/utils/translations";
import type { CategoryFacetsResult } from "@/features/attributes/db/facets";
import {
  parseAttrs,
  serializeAttrs,
  findOptionFilter,
  findRangeFilter,
  hasBoolFilter,
  setOptionFilter,
  setRangeFilter,
  setBoolFilter,
} from "@/lib/query/attrs";
import { useQueryStates } from "nuqs";
import {
  productSearchParams,
  WARRANTY_BUCKETS,
  type ProductFilters,
} from "@/lib/query/searchParams";
import { countryName } from "@/lib/i18n/countries";
import {
  FilterSidebar,
  FILTER_OPTIONS_VISIBLE_LIMIT,
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
import { useCurrencyStore, getCurrentRate } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";
import { cn } from "@/lib/utils";

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
  tags = [],
  footer,
  lockedBrandId,
  currentDept,
}: {
  brands?: BrandOption[];
  categoryTree?: CategoryTreeItem[];
  tags?: TagListItem[];
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

  // shallow: all data here is client-fetched (react-query -> /api/products,
  // /api/facets) off the committed URL below, not re-rendered server-side per
  // filter click. shallow:false would force a full Next.js router navigation
  // (RSC round-trip) on every checkbox click, which is what made checkboxes
  // feel laggy - the `checked` state below can't flip until that navigation
  // resolves. shallow:true updates the URL (and useSearchParams) immediately.
  const [, setParams] = useQueryStates(productSearchParams, {
    shallow: true,
    throttleMs: 300,
  });

  // Read EVERY filter from the committed URL, not from nuqs's returned state:
  // nuqs keeps a global pending-queue singleton whose values otherwise leak
  // across a route change (e.g. /products filters bleeding onto /admin/products).
  // Writes still go through nuqs `setParams`; filter clicks pass `throttleMs: 0`
  // (see handlers) so the URL commits at once with nothing left queued.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";
  const params = useMemo(() => {
    const boolParam = (k: string) => {
      const v = urlSearchParams.get(k);
      return v === "true" ? true : v === "false" ? false : null;
    };
    return {
      sortBy: ((urlSearchParams.get("sortBy") as ProductFilters["sortBy"]) || "createdAt"),
      sortOrder: (urlSearchParams.get("sortOrder") === "asc" ? "asc" : "desc") as "asc" | "desc",
      minPrice: urlSearchParams.get("minPrice") ? Number(urlSearchParams.get("minPrice")) : null,
      maxPrice: urlSearchParams.get("maxPrice") ? Number(urlSearchParams.get("maxPrice")) : null,
      onSale: boolParam("onSale"),
      bestseller: boolParam("bestseller"),
      isDigital: boolParam("isDigital"),
      minWarranty: urlSearchParams.get("minWarranty")
        ? parseInt(urlSearchParams.get("minWarranty")!, 10)
        : null,
      origin: urlSearchParams.get("origin")?.split(",").filter(Boolean) ?? [],
      brandId: urlSearchParams.get("brandId")?.split(",").filter(Boolean) ?? [],
      tagId: urlSearchParams.get("tagId")?.split(",").filter(Boolean) ?? [],
      minRating: urlSearchParams.get("minRating") ? parseInt(urlSearchParams.get("minRating")!, 10) : null,
      dept: urlSearchParams.get("dept") ?? "",
      attrs: urlSearchParams.get("attrs") ?? "",
    };
  }, [urlSearchParams]);

  const dept = currentDept ?? params.dept;
  const attrFilters = useMemo(() => parseAttrs(params.attrs), [params.attrs]);
  const lockedOrParamBrand = lockedBrandId ? [lockedBrandId] : params.brandId;

  // ---- Category facets (with counts) ----
  // Counts reflect every other active filter (incl. other attribute selections)
  // so the Amazon-style multi-select facet stays meaningful as you refine.
  const facetsQuery = useQuery<CategoryFacetsResult>({
    queryKey: [
      "facets",
      dept,
      currency,
      params.minPrice,
      params.maxPrice,
      params.onSale,
      params.bestseller,
      params.isDigital,
      params.minWarranty,
      params.origin.join(","),
      params.minRating,
      lockedOrParamBrand.join(","),
      params.tagId.join(","),
      search,
      params.attrs,
      locale,
    ],
    queryFn: async () => {
      const rate = getCurrentRate();
      const sp = new URLSearchParams();
      sp.set("dept", dept);
      sp.set("searchLocale", locale);
      if (search) sp.set("search", search);
      if (params.minPrice != null) sp.set("minPrice", String(params.minPrice / rate));
      if (params.maxPrice != null) sp.set("maxPrice", String(params.maxPrice / rate));
      if (params.onSale === true) sp.set("onSale", "true");
      if (params.bestseller === true) sp.set("bestseller", "true");
      if (params.isDigital != null) sp.set("isDigital", String(params.isDigital));
      if (params.minWarranty != null) sp.set("minWarranty", String(params.minWarranty));
      for (const code of params.origin) sp.append("origin", code);
      for (const id of lockedOrParamBrand) sp.append("brandId", id);
      for (const id of params.tagId) sp.append("tagId", id);
      if (params.minRating != null) sp.set("minRating", String(params.minRating));
      if (params.attrs) sp.set("attrs", params.attrs);
      const { data } = await axios.get(`/api/facets?${sp.toString()}`);
      return data as CategoryFacetsResult;
    },
    // Keep the previous facets (and their counts) visible while a new filter
    // combination refetches, instead of the query key change resetting data
    // to undefined mid-flight - that gap was flipping `countsReady` false for
    // a moment, briefly reverting to the unfiltered/count-less option list
    // (a flash of options with no products popping in and back out).
    placeholderData: keepPreviousData,
  });
  const facets = useMemo(() => facetsQuery.data?.facets ?? [], [facetsQuery.data]);
  const brandCounts = useMemo(
    () => facetsQuery.data?.brandCounts ?? {},
    [facetsQuery.data],
  );
  const tagCounts = useMemo(
    () => facetsQuery.data?.tagCounts ?? {},
    [facetsQuery.data],
  );
  // Base-refinement counts are only authoritative once the request resolves;
  // until then the toggles render without counts (and without hide-empty) to
  // avoid a flash of disappearing filters on first paint.
  const countsReady = facetsQuery.isSuccess;
  const onSaleCount = facetsQuery.data?.onSaleCount ?? 0;
  const bestsellerCount = facetsQuery.data?.bestsellerCount ?? 0;
  const isDigitalCounts = useMemo(
    () => facetsQuery.data?.isDigitalCounts ?? { true: 0, false: 0 },
    [facetsQuery.data],
  );
  const originCounts = useMemo(
    () => facetsQuery.data?.originCounts ?? {},
    [facetsQuery.data],
  );
  const warrantyCounts = useMemo(
    () => facetsQuery.data?.warrantyCounts ?? {},
    [facetsQuery.data],
  );

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
    ];

    // Deals: on-sale + bestseller are independent boolean refinements grouped
    // under one heading (both are disjunctive-count + hide-empty, like brand
    // and the attribute facets - a selected value stays visible so the buyer
    // can always clear it). Until the first facet request resolves both
    // render plain (no count, no hide-empty) to avoid a flash of disappearing
    // filters. Bestseller is tied to the algorithmic `Product.isBestseller`
    // badge, not a tag - see prisma/seed.ts's tag pool comment.
    const dealsOptions: { value: string; label: string; count?: number }[] = [];
    if (!countsReady || onSaleCount > 0 || params.onSale === true) {
      dealsOptions.push(
        countsReady
          ? { value: "onSale", label: t("products.onSale"), count: onSaleCount }
          : { value: "onSale", label: t("products.onSale") },
      );
    }
    if (!countsReady || bestsellerCount > 0 || params.bestseller === true) {
      dealsOptions.push(
        countsReady
          ? { value: "bestseller", label: t("products.bestseller"), count: bestsellerCount }
          : { value: "bestseller", label: t("products.bestseller") },
      );
    }
    if (dealsOptions.length > 0) {
      groups.push({
        type: "checkbox",
        key: "deals",
        label: t("products.deals"),
        options: dealsOptions,
        // `pending`, not just `countsPending`: both toggles are hide-empty, so
        // an option that ends up at zero is painted and then pulled back out.
        // Having only two candidates does NOT make that acceptable - a label
        // that appears and vanishes is the same glitch whether it is one row or
        // twelve (spotted on a brand page, where "Digital" flashed in before
        // the count came back 0).
        pending: !countsReady,
        pendingRows: dealsOptions.length,
      });
    }

    const typeOptions: { value: string; label: string; count?: number }[] = countsReady
      ? [
          { value: "false", label: t("products.physical"), count: isDigitalCounts.false },
          { value: "true", label: t("products.digital"), count: isDigitalCounts.true },
        ].filter(
          (o) =>
            o.count > 0 ||
            (o.value === "false" ? params.isDigital === false : params.isDigital === true),
        )
      : [
          { value: "false", label: t("products.physical") },
          { value: "true", label: t("products.digital") },
        ];
    if (typeOptions.length > 0) {
      groups.push({
        type: "checkbox",
        key: "isDigital",
        label: t("products.productType"),
        options: typeOptions,
        // Same as `deals` above - physical/digital is hide-empty too, so a
        // storefront with no digital products flashed "Digital" and dropped it.
        pending: !countsReady,
        pendingRows: typeOptions.length,
      });
    }

    // Warranty: a floor ladder, not a value set. Buckets with no products are
    // dropped (unless selected) exactly like the other hide-empty groups, so a
    // catalogue with no long warranties does not advertise a "60+ months"
    // option that can only ever return nothing.
    const warrantyOptions: { value: string; label: string; count?: number }[] = countsReady
      ? WARRANTY_BUCKETS.map((months) => ({
          value: String(months),
          label: t("products.warrantyAtLeast", { count: months }),
          count: warrantyCounts[months] ?? 0,
        })).filter((o) => (o.count ?? 0) > 0 || params.minWarranty === Number(o.value))
      : WARRANTY_BUCKETS.map((months) => ({
          value: String(months),
          label: t("products.warrantyAtLeast", { count: months }),
        }));
    if (warrantyOptions.length > 0) {
      groups.push({
        type: "checkbox",
        key: "minWarranty",
        label: t("products.warranty"),
        options: warrantyOptions,
        pending: !countsReady,
        pendingRows: warrantyOptions.length,
      });
    }

    // Origin: driven entirely by what the current result set actually contains,
    // so the list is never the full ISO table - only countries with products.
    // Sorted by count, then by localized name for a stable order.
    const originOptions = Object.entries(originCounts)
      .filter(([code, count]) => count > 0 || params.origin.includes(code))
      .map(([code, count]) => ({
        value: code,
        label: countryName(code, locale),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));
    if (originOptions.length > 0) {
      groups.push({
        type: "checkbox",
        key: "origin",
        label: t("products.countryOfOrigin"),
        options: originOptions,
        pending: !countsReady,
        pendingRows: Math.min(originOptions.length, 8),
      });
    }

    // Brand: same disjunctive-count + hide-empty treatment as the facets. Counts
    // come from the facet endpoint, which now computes them globally too, so this
    // works on `/products` and brand pages, not just category pages. Hide the
    // group entirely when no brand matches (no orphan "Brand" heading). Hidden
    // when the page already pins a brand (brand storefront).
    //
    // Brand and tag are the two groups where you cannot tell in advance WHICH
    // of a long list survives the count filter, so they render placeholder rows
    // until the request resolves (see CheckboxFilterGroup.pending). The short
    // `deals` / `isDigital` groups above keep painting their real labels: their
    // candidates are fixed and known, and at most one row drops - a legible
    // change, unlike a dozen brand names disappearing.
    if (brands.length > 0 && !lockedBrandId) {
      const selectedBrands = new Set(params.brandId);
      const brandOptions = countsReady
        ? brands
            .map((b) => ({
              value: b.id,
              label: getBrandName(b, locale),
              count: brandCounts[b.id] ?? 0,
            }))
            .filter((b) => b.count > 0 || selectedBrands.has(b.value))
        // Full list while pending: <CheckboxFilter> draws placeholders instead,
        // but <ActiveFilters> still needs it to label a selected chip.
        : brands.map((b) => ({ value: b.id, label: getBrandName(b, locale) }));
      if (brandOptions.length > 0) {
        groups.push({
          type: "checkbox",
          key: "brandId",
          label: t("products.brand"),
          options: brandOptions,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
          pending: !countsReady,
          pendingRows: Math.min(brands.length, FILTER_OPTIONS_VISIBLE_LIMIT),
        });
      }
    }

    // Tag: same disjunctive-count + hide-empty treatment as brand.
    if (tags.length > 0) {
      const selectedTags = new Set(params.tagId);
      const tagOptions = countsReady
        ? tags
            .map((tg) => ({
              value: tg.id,
              label: getTagName(tg, locale),
              count: tagCounts[tg.id] ?? 0,
            }))
            .filter((tg) => tg.count > 0 || selectedTags.has(tg.value))
        : tags.map((tg) => ({ value: tg.id, label: getTagName(tg, locale) }));
      if (tagOptions.length > 0) {
        groups.push({
          type: "checkbox",
          key: "tagId",
          label: t("products.tags"),
          options: tagOptions,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
          pending: !countsReady,
          pendingRows: Math.min(tags.length, FILTER_OPTIONS_VISIBLE_LIMIT),
        });
      }
    }

    // Category-specific facets (own + inherited), keyed `attr:<attributeKey>`.
    for (const f of facets) {
      const baseLabel = getLabel(f.translations, locale);
      if (f.type === "SELECT" || f.type === "MULTI_SELECT") {
        groups.push({
          type: "checkbox",
          key: `attr:${f.key}`,
          label: baseLabel,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
          options: f.options.map((o) => ({
            value: o.value,
            label: getLabel(o.translations, locale),
            count: o.count,
          })),
        });
      } else if (f.type === "BOOLEAN") {
        groups.push({
          type: "checkbox",
          key: `attr:${f.key}`,
          label: baseLabel,
          options: [{ value: "on", label: t("search.yes"), count: f.trueCount }],
        });
      } else if (f.type === "RANGE") {
        groups.push({
          type: "range",
          key: `attr:${f.key}`,
          label: f.unit ? `${baseLabel} (${f.unit})` : baseLabel,
          min: f.bounds?.min ?? undefined,
          max: f.bounds?.max ?? undefined,
          step: 1,
        });
      }
    }

    return groups;
  }, [
    brands,
    lockedBrandId,
    tags,
    t,
    currencySymbol,
    locale,
    facets,
    countsReady,
    brandCounts,
    tagCounts,
    onSaleCount,
    bestsellerCount,
    isDigitalCounts,
    originCounts,
    warrantyCounts,
    params.minWarranty,
    params.origin,
    params.brandId,
    params.tagId,
    params.onSale,
    params.bestseller,
    params.isDigital,
  ]);

  // ---- Filter values ----
  // URL stores values as typed by user (in selected currency) - no conversion, no rounding.
  const filterValues: FilterValues = {
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    minRating: params.minRating ?? null,
    deals: [
      ...(params.onSale === true ? ["onSale"] : []),
      ...(params.bestseller === true ? ["bestseller"] : []),
    ],
    isDigital: params.isDigital != null ? [String(params.isDigital)] : [],
    minWarranty: params.minWarranty != null ? [String(params.minWarranty)] : [],
    origin: params.origin,
    brandId: params.brandId,
    tagId: params.tagId,
  };
  for (const f of facets) {
    const k = `attr:${f.key}`;
    if (f.type === "RANGE") {
      const [mn, mx] = findRangeFilter(attrFilters, f.key);
      filterValues[k] = [mn ?? undefined, mx ?? undefined];
    } else if (f.type === "BOOLEAN") {
      filterValues[k] = hasBoolFilter(attrFilters, f.key) ? ["on"] : [];
    } else {
      filterValues[k] = findOptionFilter(attrFilters, f.key);
    }
  }

  // ---- Handlers ----
  // Filter writes commit immediately (no throttle) so nothing stays queued to
  // leak into the next route, and the URL-derived read above updates at once.
  const NOW = { throttleMs: 0 } as const;

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
    resetGridScroll();
    if (key.startsWith("attr:")) {
      const fk = key.slice(5);
      const facet = facets.find((f) => f.key === fk);
      let next = attrFilters;
      if (facet?.type === "RANGE") {
        const [min, max] = value as [number?, number?];
        next = setRangeFilter(attrFilters, fk, min ?? null, max ?? null);
      } else if (facet?.type === "BOOLEAN") {
        next = setBoolFilter(attrFilters, fk, (value as string[]).includes("on"));
      } else {
        next = setOptionFilter(attrFilters, fk, value as string[]);
      }
      setParams({ attrs: serializeAttrs(next) }, NOW);
      return;
    }
    if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null }, NOW);
    } else if (key === "minRating") {
      setParams({ minRating: (value as number | null) ?? null }, NOW);
    } else if (key === "deals") {
      const vals = value as string[];
      setParams(
        {
          onSale: vals.includes("onSale") ? true : null,
          bestseller: vals.includes("bestseller") ? true : null,
        },
        NOW,
      );
    } else if (key === "isDigital") {
      const vals = value as string[];
      if (vals.length === 0 || vals.length === 2) setParams({ isDigital: null }, NOW);
      else setParams({ isDigital: vals[0] === "true" }, NOW);
    } else if (key === "minWarranty") {
      // Single-choice ladder rendered as checkboxes: the last box ticked wins,
      // so picking "24+" after "12+" replaces it instead of intersecting to
      // something unsatisfiable.
      const vals = value as string[];
      const picked = vals.find((v) => v !== String(params.minWarranty)) ?? vals[0];
      setParams({ minWarranty: picked ? parseInt(picked, 10) : null }, NOW);
    } else if (key === "origin") {
      setParams({ origin: value as string[] }, NOW);
    } else if (key === "brandId") {
      setParams({ brandId: value as string[] }, NOW);
    } else if (key === "tagId") {
      setParams({ tagId: value as string[] }, NOW);
    }
  };

  const handleFilterClear = () => {
    resetGridScroll();
    setParams({
      minPrice: null,
      maxPrice: null,
      onSale: null,
      bestseller: null,
      isDigital: null,
      minWarranty: null,
      origin: [],
      brandId: [],
      tagId: [],
      minRating: null,
      attrs: "",
    }, NOW);
  };

  const handleFilterRemove = (key: string, value?: string) => {
    resetGridScroll();
    if (key.startsWith("attr:")) {
      const fk = key.slice(5);
      const facet = facets.find((f) => f.key === fk);
      if (value && (facet?.type === "SELECT" || facet?.type === "MULTI_SELECT")) {
        const nextVals = findOptionFilter(attrFilters, fk).filter((v) => v !== value);
        setParams({ attrs: serializeAttrs(setOptionFilter(attrFilters, fk, nextVals)) }, NOW);
      } else {
        setParams({ attrs: serializeAttrs(attrFilters.filter((f) => f.key !== fk)) }, NOW);
      }
    } else if (key === "price") setParams({ minPrice: null, maxPrice: null }, NOW);
    else if (key === "minRating") setParams({ minRating: null }, NOW);
    else if (key === "deals") {
      if (value === "onSale") setParams({ onSale: null }, NOW);
      else if (value === "bestseller") setParams({ bestseller: null }, NOW);
    }
    else if (key === "isDigital") setParams({ isDigital: null }, NOW);
    else if (key === "minWarranty") setParams({ minWarranty: null }, NOW);
    else if (key === "origin") {
      setParams({ origin: value ? params.origin.filter((v) => v !== value) : [] }, NOW);
    }
    else if (key === "brandId") {
      setParams({ brandId: value ? params.brandId.filter((v) => v !== value) : [] }, NOW);
    } else if (key === "tagId") {
      setParams({ tagId: value ? params.tagId.filter((v) => v !== value) : [] }, NOW);
    }
  };

  const filters: ProductFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    // Raw display-currency values - buildFetcher converts to USD at fetch time.
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    onSale: params.onSale,
    bestseller: params.bestseller,
    isDigital: params.isDigital,
    minWarranty: params.minWarranty,
    origin: params.origin,
    // Locked dimensions take precedence so the visitor can't unlock the
    // brand storefront / category page via URL tampering.
    brandId: lockedBrandId ? [lockedBrandId] : params.brandId,
    tagId: params.tagId,
    minRating: params.minRating,
    dept,
    attrs: params.attrs,
  };

  const outerScrollRef = useRef<HTMLDivElement>(null);

  // Sidebar's sticky max-height must match the scroll container's ACTUAL
  // available height, not a guessed viewport-minus-constant - the header
  // stack above it (breadcrumbs, search bar, active-filter pills) varies by
  // page and grows/shrinks at runtime, so any fixed offset drifts out of
  // sync and leaves part of the sidebar unreachable until the (unrelated)
  // product grid is scrolled to its own bottom. Measuring the real box
  // keeps it correct through every resize/content change automatically.
  const [sidebarMaxHeight, setSidebarMaxHeight] = useState<number>();
  useEffect(() => {
    const el = outerScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSidebarMaxHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filter interactions reset the shared grid/sidebar scroll to the top -
  // otherwise the viewport is left at whatever scroll position it happened
  // to be at, which reads as broken once the result set underneath changes.
  const resetGridScroll = () => {
    outerScrollRef.current?.scrollTo({ top: 0 });
  };

  const hasActiveFilters = Object.values(filterValues).some((v) =>
    Array.isArray(v) ? v.some((item) => item != null) : v != null,
  );

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
          onSortByChange={(v) => setParams({ sortBy: v as ProductFilters["sortBy"] }, NOW)}
          onSortOrderChange={(v) => setParams({ sortOrder: v }, NOW)}
          sortOptions={SORT_OPTIONS}
          filterGroups={filterGroups}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onFilterClear={handleFilterClear}
        />
        {/* grid-rows 0fr->1fr animates the pills row in/out smoothly instead
            of the grid below snapping down the instant a chip appears. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            hasActiveFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <ActiveFilters
              groups={filterGroups}
              values={filterValues}
              onRemove={handleFilterRemove}
              onClearAll={handleFilterClear}
            />
          </div>
        </div>
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
            maxHeightPx={sidebarMaxHeight}
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
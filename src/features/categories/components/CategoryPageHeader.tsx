import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/Breadcrumbs";
import { pressNavLink } from "@/components/ui/pressable";
import { getCategoryName } from "@/features/categories/utils/translations";

export type CategoryChip = { id: string; slug: string; name: string };

type HeaderTranslation = { locale: string; name: string; slug: string; description: string | null };
type HeaderCategory = {
  translations: readonly HeaderTranslation[];
  children: readonly { id: string; translations: readonly HeaderTranslation[] }[];
};

type Locale = (typeof routing.locales)[number];

/**
 * Everything <CategoryPageHeader> shows, resolved from a category, its parent
 * and the URL slug. Shared by the page (database rows) and its loading state
 * (the layout's category tree), so both pick the same translation, the same
 * fallbacks and the same chips.
 */
export function categoryHeaderProps({
  category,
  parent,
  slug,
  locale,
  labels,
}: {
  category: HeaderCategory;
  parent: { translations: readonly HeaderTranslation[] } | null;
  /** The slug in the URL - the trail's last crumb points at it. */
  slug: string;
  locale: Locale;
  labels: { home: string; products: string; back: string };
}): Omit<React.ComponentProps<typeof CategoryPageHeader>, "seo"> {
  const byLocale = (rows: readonly HeaderTranslation[]) =>
    rows.find((tr) => tr.locale === locale) ??
    rows.find((tr) => tr.locale === routing.defaultLocale);
  const localT = byLocale(category.translations) ?? category.translations[0];
  const title = getCategoryName(category, locale);
  const parentT = parent ? byLocale(parent.translations) : null;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: labels.home, href: getPathname({ href: "/", locale }) },
    { name: labels.products, href: getPathname({ href: "/products", locale }) },
    ...(parent && parentT
      ? [{
          name: getCategoryName(parent, locale),
          href: getPathname({
            href: { pathname: "/categories/[slug]", params: { slug: parentT.slug } },
            locale,
          }),
        }]
      : []),
    {
      name: title,
      href: getPathname({ href: { pathname: "/categories/[slug]", params: { slug } }, locale }),
    },
  ];

  const chips: CategoryChip[] = [];
  for (const child of category.children) {
    const childT = byLocale(child.translations);
    if (childT) chips.push({ id: child.id, slug: childT.slug, name: getCategoryName(child, locale) });
  }

  return {
    breadcrumbs,
    title,
    description: localT?.description ?? undefined,
    backLabel: labels.back,
    chips,
  };
}

/**
 * The category page's header block: breadcrumb trail, title and description,
 * the "Back to shop" button and the subcategory chips. One component for the
 * page and for its `loading.tsx` (which draws it from the layout's category
 * tree), so the two cannot drift apart by a pixel. No hooks: every string comes
 * in resolved.
 */
export function CategoryPageHeader({
  breadcrumbs,
  title,
  description,
  backLabel,
  chips,
  seo = true,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: string;
  backLabel: string;
  chips: CategoryChip[];
  /** The breadcrumb JSON-LD - the page only, never the loading state. */
  seo?: boolean;
}) {
  return (
    <div className="shrink-0 px-6 pt-2 pb-3 sticky-header-bg">
      <Breadcrumbs items={breadcrumbs} seo={seo} />
      <PageHeader title={title} description={description}>
        <Button asChild variant="outline">
          <Link href="/products">{backLabel}</Link>
        </Button>
      </PageHeader>

      {/* Subcategory chips - only for a department with children that have
          something to buy (the storefront tree's own pruning, the same list
          the mega menu shows), in the admin's order. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {chips.map((chip) => (
            <Link
              key={chip.id}
              href={{ pathname: "/categories/[slug]", params: { slug: chip.slug } }}
              className={`rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors ${pressNavLink}`}
            >
              {chip.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

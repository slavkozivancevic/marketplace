import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/Breadcrumbs";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { getBrandName } from "@/features/brands/utils/translations";
import type { LogoBackdrop } from "@/features/brands/components/BrandLogo";

type Locale = (typeof routing.locales)[number];

/** What the brand page's header reads from a brand row. */
export type BrandHeaderSource = {
  logoUrl: string | null;
  logoUrlDark: string | null;
  logoBackdrop: LogoBackdrop;
  logoBackdropDark: LogoBackdrop;
  translations: readonly { locale: string; name: string; slug: string; description: string | null }[];
};

type BrandHeaderProps = {
  breadcrumbs: BreadcrumbItem[];
  brand: BrandHeaderSource;
  name: string;
  description: string | null;
  backLabel: string;
};

/**
 * Everything <BrandPageHeader> shows, resolved from a brand row and the URL
 * slug - shared by the page and its loading state, so both pick the same
 * translation and the same fallbacks.
 */
export function brandHeaderProps({
  brand,
  slug,
  locale,
  labels,
}: {
  brand: BrandHeaderSource;
  slug: string;
  locale: Locale;
  labels: { home: string; brands: string; back: string };
}): BrandHeaderProps {
  const localT =
    brand.translations.find((tr) => tr.locale === locale) ??
    brand.translations.find((tr) => tr.locale === routing.defaultLocale) ??
    brand.translations[0];
  // A present row does not guarantee a non-blank name, so the heading and the
  // crumb read through `getBrandName` rather than `localT`.
  const name = getBrandName(brand, locale);
  return {
    breadcrumbs: [
      { name: labels.home, href: getPathname({ href: "/", locale }) },
      { name: labels.brands, href: getPathname({ href: "/brands", locale }) },
      { name, href: getPathname({ href: { pathname: "/brands/[slug]", params: { slug } }, locale }) },
    ],
    brand,
    name,
    description: localT?.description ?? null,
    backLabel: labels.back,
  };
}

/**
 * The brand page's hero strip: breadcrumb trail, the 64px logo, the name and
 * description, and "Back to brands". One component for the page and for its
 * `loading.tsx`, so the two cannot drift apart. No hooks.
 */
export function BrandPageHeader({
  breadcrumbs,
  brand,
  name,
  description,
  backLabel,
  seo = true,
}: BrandHeaderProps & {
  /** The breadcrumb JSON-LD - the page only, never the loading state. */
  seo?: boolean;
}) {
  return (
    <div className="shrink-0 px-6 pt-2 pb-4 mb-2 sticky-header-bg">
      <Breadcrumbs items={breadcrumbs} seo={seo} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <BrandLogo
            src={brand.logoUrl}
            srcDark={brand.logoUrlDark}
            backdrop={brand.logoBackdrop}
            backdropDark={brand.logoBackdropDark}
            name={name}
            size={64}
          />
          <div className="space-y-0.5 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{name}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Button asChild variant="outline">
            <Link href="/brands">{backLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

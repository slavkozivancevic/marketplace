import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CacheTags } from "@/lib/cache/tags";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { RetryImage } from "@/components/RetryImage";
import { absoluteUrl } from "@/lib/seo/jsonLd";
import { ImageOff } from "lucide-react";
import {
  getDepartmentsWithImages,
  getStorefrontCategoryTree,
} from "@/features/categories/db/categories";
import { getCategoryName } from "@/features/categories/utils/translations";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Route segment, not getLocale() - see the products list page for why.
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "categories" });

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = absoluteUrl(getPathname({ href: "/categories", locale: l }));
  }

  return {
    title: t("directoryTitle"),
    description: t("directoryDescription"),
    alternates: { canonical: languages[locale], languages },
    openGraph: {
      title: t("directoryTitle"),
      description: t("directoryDescription"),
      locale,
      type: "website",
    },
  };
}

/**
 * Every department, with a thumbnail and how many subcategories sit under it.
 *
 * Two reads rather than one: the department thumbnails come from
 * `getDepartmentsWithImages` (which already walks each department's products
 * for a picture), and the tree supplies the child counts and this locale's
 * slugs. Both are tagged with the category cache tag, so an admin editing a
 * category busts this page along with the menu built from the same tree.
 */
async function fetchDirectory() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  // The thumbnails are product images, so a catalogue change has to drop this
  // too - otherwise a department keeps showing a picture of something that is
  // no longer published.
  cacheTag(CacheTags.products.publicAll());

  const [departments, tree] = await Promise.all([
    getDepartmentsWithImages({ featuredOnly: false }),
    getStorefrontCategoryTree(),
  ]);
  return { departments, tree };
}

export default async function CategoriesDirectoryPage() {
  const locale = await getLocale();
  const t = await getTranslations("categories");
  const tCrumbs = await getTranslations("breadcrumbs");
  const { departments, tree } = await fetchDirectory();

  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("categories"), href: getPathname({ href: "/categories", locale }) },
  ];

  const childCount = new Map(tree.map((node) => [node.id, node.children.length]));
  // This locale's own slug, falling back the way the rest of the storefront
  // does - a department with no row for the active locale still has to be
  // reachable, through English or whatever row exists.
  const slugOf = (id: string) => {
    const node = tree.find((n) => n.id === id);
    return (
      node?.translations.find((tr) => tr.locale === locale)?.slug ??
      node?.translations.find((tr) => tr.locale === routing.defaultLocale)?.slug ??
      node?.translations[0]?.slug ??
      null
    );
  };

  const cards = departments
    .map((d) => ({ dept: d, slug: slugOf(d.id) }))
    .filter((c): c is { dept: (typeof departments)[number]; slug: string } => c.slug !== null);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader title={t("directoryTitle")} description={t("directoryDescription")} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCategories")}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {cards.map(({ dept, slug }) => {
                const name = getCategoryName(dept, locale);
                const image = dept.productImages[0] ?? dept.imageUrl;
                const children = childCount.get(dept.id) ?? 0;
                return (
                  <Link
                    key={dept.id}
                    href={{ pathname: "/categories/[slug]", params: { slug } }}
                    className="group rounded-lg border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="relative mb-2 aspect-square w-full max-w-full overflow-hidden rounded bg-muted/40">
                      {image ? (
                        <RetryImage
                          src={image}
                          alt={name}
                          fill
                          sizes="(max-width: 640px) 45vw, (max-width: 1280px) 22vw, 15vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageOff className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    {/* Both text boxes are reserved whether or not they are
                        filled, so every tile is the same height: `2lh` is two
                        of THIS element's own line boxes, so it follows the font
                        and the translation instead of a hard-coded pixel
                        guess. Measured at 320px without it, the grid came out
                        in two heights - 173px for a one-line name, 193px for a
                        wrapped one - and the rows read as ragged. */}
                    <p className="min-h-[2lh] text-sm font-medium leading-snug line-clamp-2">
                      {name}
                    </p>
                    <p className="mt-0.5 min-h-[1lh] text-xs text-muted-foreground">
                      {children > 0 ? t("subcategoryCount", { count: children }) : null}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}

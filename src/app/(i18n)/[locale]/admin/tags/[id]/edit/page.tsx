import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getTagById } from "@/features/tags/db/tags";
import type { TagTranslations } from "@/features/tags/utils/translations";
import { TagForm } from "@/features/tags/components/TagForm";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";

export default async function EditTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;
  const tag = await fetchTag(id);

  if (!tag) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminTags"), href: getPathname({ href: "/admin/tags", locale }) },
    {
      name: tCrumbs("editTag"),
      href: getPathname({ href: { pathname: "/admin/tags/[id]/edit", params: { id } }, locale }),
    },
  ];

  // Form input is keyed by canonical English fields + a non-default
  // translations map. Extract each locale's row from the relation.
  const en = tag.translations.find((tr) => tr.locale === DEFAULT_LOCALE);
  const nonDefault: TagTranslations = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = tag.translations.find((tr) => tr.locale === loc);
    if (row) {
      // The stored slug MUST round-trip through the form. Omitting it would
      // make every save regenerate the slug from the (possibly unchanged)
      // name, which collides with the source tag after a duplicate.
      nonDefault[loc] = { name: row.name, slug: row.slug };
    }
  }

  const displayName =
    tag.translations.find((tr) => tr.locale === locale)?.name ?? en?.name ?? "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.editTag", { name: displayName })}
          description={t("admin.editTagDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/tags">{t("admin.backToTags")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {/* Fresh key forces remount on each page render so unsaved edits
            don't persist across navigations (Next.js can preserve the
            form's in-memory state otherwise). */}
        <TagForm
          key={crypto.randomUUID()}
          mode="edit"
          tagId={tag.id}
          defaultValues={{
            name: en?.name ?? "",
            slug: en?.slug ?? "",
            translations: nonDefault,
          }}
        />
      </div>
    </div>
  );
}

async function fetchTag(id: string) {
  "use cache";
  cacheTag(CacheTags.tags.byId(id));
  return getTagById(id);
}

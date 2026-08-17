import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getTagById } from "@/features/tags/db/tags";
import {
  getTagName,
  type TagTranslations,
} from "@/features/tags/utils/translations";
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
  // Every locale gets an entry (empty strings when no row exists yet) -
  // never skip a locale entirely. A missing key here left that locale's
  // react-hook-form default at `undefined`; typing into the empty field and
  // then deleting it back to "" would then compare "" against `undefined`
  // forever, so the changed-hint and unsaved-changes warning never cleared.
  const nonDefault: TagTranslations = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = tag.translations.find((tr) => tr.locale === loc);
    // The stored slug MUST round-trip through the form WHEN a name is
    // present - omitting it unconditionally made every save regenerate the
    // slug from the (possibly unchanged) name, which collided with the
    // source tag after a duplicate. But when name is blank, any stored slug
    // is only a derived implementation detail (see buildTagTranslationRows)
    // kept for URL validity, not something the admin entered - show it as
    // blank too rather than as if it were. Matches the brand/category pages.
    nonDefault[loc] = {
      name: row?.name ?? "",
      slug: row?.name ? (row?.slug ?? "") : "",
    };
  }

  // `getTagName` (not a raw `find(locale)?.name ?? en?.name`) - `??` stops at
  // a present-but-blank name, so it would title the page with an empty string
  // instead of falling back to English.
  const displayName = getTagName(tag, locale);

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

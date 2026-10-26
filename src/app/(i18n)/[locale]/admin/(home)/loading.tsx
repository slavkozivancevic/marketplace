import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import {
  SkeletonGreetingHeader,
  SkeletonNavCardCaption,
  SkeletonNavCardGrid,
} from "@/components/ui/skeleton";
import { adminHomeCards } from "./cards";

/**
 * The admin landing page calls `await connection()` and then looks the user up
 * to greet them by name, so it is fully dynamic - nothing renders until that
 * round-trip finishes.
 *
 * Everything but the name is known here: the trail, the title, both captions
 * and every card, from the same `adminHomeCards` list the page renders. Only
 * the welcome line, which names the user, is a bar.
 */
export default async function AdminHomeLoading() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { manage, quick } = adminHomeCards(t);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SkeletonGreetingHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
              { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
            ]}
            seo={false}
          />
        }
        title={t("admin.title")}
      />
      <div aria-hidden className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        <div>
          <SkeletonNavCardCaption>{t("admin.management")}</SkeletonNavCardCaption>
          <SkeletonNavCardGrid cards={manage} />
        </div>
        <div>
          <SkeletonNavCardCaption>{t("admin.quickLinks")}</SkeletonNavCardCaption>
          <SkeletonNavCardGrid cards={quick} />
        </div>
      </div>
    </div>
  );
}

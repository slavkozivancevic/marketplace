import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { DashboardHomeSkeleton } from "./HomeSkeleton";

/**
 * Same shape as the admin landing page - see ../../../admin/(home)/loading.tsx.
 *
 * Which cards the page shows depends on the viewer (role, active org, payout
 * rights), and the quick-links section is admin-only. The dashboard layout
 * already knows all of that and provides it, so the skeleton draws exactly the
 * viewer's page rather than a guessed count.
 */
export default async function DashboardHomeLoading() {
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  return (
    <DashboardHomeSkeleton
      breadcrumbs={
        <Breadcrumbs
          items={[
            { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
            { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
          ]}
          seo={false}
        />
      }
    />
  );
}

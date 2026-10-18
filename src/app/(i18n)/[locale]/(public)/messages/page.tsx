import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { MessagesPage } from "@/features/chat/components/MessagesPage";

export async function generateMetadata() {
  const t = await getTranslations("chat");
  // One user's private conversations - nothing a crawler should ever reach,
  // and the proxy sends anonymous visitors to sign-in anyway.
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function MessagesRoute() {
  // The page reads its selection from `?c=` on the client; opting into
  // runtime rendering keeps that search-param read out of the prerender.
  await connection();
  const locale = await getLocale();
  const tCrumbs = await getTranslations("breadcrumbs");
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("messages"), href: getPathname({ href: "/messages", locale }) },
  ];

  // No server data: conversations live in the messaging service and arrive
  // over the client's own chat connection, so the client skeleton is the
  // single loading state.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* `seo={false}`: noindex page, same call as cart and checkout. */}
        <Breadcrumbs items={breadcrumbItems} seo={false} />
      </div>
      <MessagesPage />
    </div>
  );
}

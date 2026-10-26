import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { MessagesPageSkeleton } from "@/features/chat/components/MessagesPageSkeleton";

/**
 * Messages page skeleton.
 *
 * Returns a FRAGMENT, like the cart's: the `(public)` layout's <main> is the
 * flex column. The body is shared with `MessagesPage`, which shows it until
 * the chat connection is up.
 */
export default async function MessagesLoading() {
  const locale = await getLocale();
  const tCrumbs = await getTranslations("breadcrumbs");
  return (
    <>
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* The trail is static copy, so it is the real one - a bar per
            crumb could only guess each word's width. */}
        <Breadcrumbs
          items={[
            { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
            { name: tCrumbs("messages"), href: getPathname({ href: "/messages", locale }) },
          ]}
          seo={false}
        />
      </div>
      <MessagesPageSkeleton />
    </>
  );
}

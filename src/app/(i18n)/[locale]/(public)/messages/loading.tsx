import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { MessagesPageSkeleton } from "@/features/chat/components/MessagesPageSkeleton";

/**
 * Messages page skeleton.
 *
 * Returns a FRAGMENT, like the cart's: the `(public)` layout's <main> is the
 * flex column. The body is shared with `MessagesPage`, which shows it until
 * the chat connection is up.
 */
export default function MessagesLoading() {
  return (
    <>
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* home / messages */}
        <SkeletonBreadcrumbs segments={2} />
      </div>
      <MessagesPageSkeleton />
    </>
  );
}

import { Skeleton, SkeletonArray } from "@/components/ui/skeleton";
import { MESSAGES_FRAME_CLASS, MESSAGES_HEADER_CLASS } from "./messagesLayout";

/**
 * The messages page body before the chat connection is up. Two callers, one
 * shape: the route's `loading.tsx`, and `MessagesPage` itself until the
 * runtime arrives. Repeats the page's frame and its `h-16` column header, so
 * nothing moves when the real inbox renders; the thread side stays empty, as
 * the real page does until a conversation is picked.
 */
export function MessagesPageSkeleton() {
  return (
    <div className={MESSAGES_FRAME_CLASS}>
      <div className="flex w-full lg:w-80 shrink-0 flex-col lg:border-r">
        <div className={MESSAGES_HEADER_CLASS}>
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="shrink-0 border-b px-3 py-2">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex flex-col gap-1 p-2">
          <SkeletonArray amount={5}>
            <div className="flex items-center gap-3 p-3">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </SkeletonArray>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 min-w-0 chat-message-bg" />
    </div>
  );
}

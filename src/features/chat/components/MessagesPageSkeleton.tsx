"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MESSAGES_FRAME_CLASS, MESSAGES_HEADER_CLASS } from "./messagesLayout";

/**
 * The messages page body before the chat connection is up. Two callers, one
 * shape: the route's `loading.tsx`, and `MessagesPage` itself until the
 * runtime arrives. Repeats the page's frame, its `h-16` column headers and
 * the inbox's search row, and draws the list and the thread with the same
 * placeholders the real page shows while ITS data loads, so nothing moves at
 * either hand-over.
 *
 * The thread side follows `?c=`, as the page does: the "pick a conversation"
 * panel without one, the loading thread with one. `useSearchParams` needs a
 * Suspense boundary in the prerendered shell, whose fallback has no URL to go
 * by and leaves the thread side empty rather than guessing.
 */
export function MessagesPageSkeleton() {
  return (
    <Suspense fallback={<MessagesFrameSkeleton selected={null} />}>
      <MessagesFrameFromUrl />
    </Suspense>
  );
}

function MessagesFrameFromUrl() {
  return <MessagesFrameSkeleton selected={!!useSearchParams().get("c")} />;
}

/** `selected` null = not known yet: inbox column only, thread side blank. */
function MessagesFrameSkeleton({ selected }: { selected: boolean | null }) {
  const t = useTranslations("chat");
  return (
    <div className={MESSAGES_FRAME_CLASS}>
      <div
        className={cn(
          "w-full lg:w-80 shrink-0 flex-col lg:border-r",
          selected ? "hidden lg:flex" : "flex",
        )}
      >
        {/* The heading is static copy, so it is the real one. */}
        <div className={MESSAGES_HEADER_CLASS}>
          <h1 className="text-base font-semibold">{t("messages")}</h1>
        </div>
        {/* InboxPanel's search row: an `h-8` input inside `px-3 py-2`. */}
        <div className="shrink-0 border-b px-3 py-2">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <ConversationListSkeleton />
      </div>
      <div
        className={cn(
          "flex-1 min-w-0 flex-col",
          selected ? "flex" : "hidden lg:flex",
        )}
      >
        {selected === null ? (
          <div className="flex-1 chat-message-bg" />
        ) : selected ? (
          <>
            <ThreadHeaderSkeleton />
            <div className="flex-1 min-h-0 overflow-hidden">
              <MessageThreadSkeleton />
            </div>
          </>
        ) : (
          <NoConversationSelected />
        )}
      </div>
    </div>
  );
}

/**
 * The page's thread header while the other side's profile and presence load:
 * ThreadHeader's own placeholders, the back arrow below `lg`, and the delete
 * icon at rest.
 */
function ThreadHeaderSkeleton() {
  return (
    <div className={MESSAGES_HEADER_CLASS}>
      {/* BackToInboxButton: `icon-sm` (28px) with `-ml-1`. */}
      <span className="-ml-1 flex size-7 shrink-0 items-center justify-center lg:hidden">
        <ArrowLeft className="size-4" />
      </span>
      <div className="flex flex-col min-w-0">
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-28" />
        </div>
        <span className="flex h-4 items-center">
          <Skeleton className="h-2.5 w-20" />
        </span>
      </div>
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <span className="flex size-7 items-center justify-center">
          <Trash2 className="size-4 text-muted-foreground" />
        </span>
      </div>
    </div>
  );
}

/** The page's thread side with nothing selected. */
export function NoConversationSelected() {
  const t = useTranslations("chat");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center chat-message-bg">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="size-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{t("selectConversation")}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("selectConversationDesc")}
      </p>
    </div>
  );
}

/**
 * ConversationList's loading state, and the page skeleton's list. A row is the
 * real row's box: `p-3` around a 36px avatar beside a 20px name line and a
 * 16px preview line `mt-0.5` under it - 62px, `gap-0.5` apart.
 */
export function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="size-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-24" />
            </div>
            <div className="mt-0.5 flex h-4 items-center">
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * MessageThread's loading state, and the page skeleton's open thread. On the
 * thread's own `chat-message-bg`, so the background does not switch from plain
 * to patterned when the messages arrive.
 */
export function MessageThreadSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4 chat-message-bg">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={cn("flex gap-2", i % 2 === 0 ? "" : "flex-row-reverse")}
        >
          <Skeleton className="size-7 rounded-full shrink-0" />
          <Skeleton
            className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-36")}
          />
        </div>
      ))}
    </div>
  );
}

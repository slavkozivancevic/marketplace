"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserPresence } from "../types";
import { describeLastSeen } from "../utils/presence";
import { formatChatDate, formatChatTime } from "../utils/dateLabels";

interface Props {
  presence?: UserPresence;
  isLoading?: boolean;
  /** Our own socket is down, so nothing we could say about them is current. */
  disconnected?: boolean;
}

/**
 * The line under the name in a conversation's header: online, when they were
 * last seen, or - when our own connection is down - that we are waiting for it.
 *
 * The connection belongs here rather than on the messages. It is a fact about
 * the conversation, not about any one message, so saying it per bubble would
 * repeat it once per queued message and would have to borrow the slot where the
 * timestamp lives. The clock on a bubble already says that message is not
 * confirmed; this line says why.
 *
 * Deliberately does NOT show typing. The animated bubble at the bottom of the
 * thread already says it, and saying it twice on one screen only splits the
 * reader's attention.
 *
 * The row keeps a FIXED height in every branch, skeleton included, so the name
 * above it never shifts as presence loads or changes.
 */
export function PresenceLine({
  presence,
  isLoading = false,
  disconnected = false,
}: Props) {
  const t = useTranslations("chat");

  // The row keeps its height in every branch below, including this one, so the
  // header never changes size between loading and loaded.
  const row = "h-4 flex items-center gap-1.5 text-[11px] leading-4 min-w-0";

  if (isLoading) {
    return (
      <span className={row}>
        <Skeleton className="h-2.5 w-20" />
      </span>
    );
  }

  // Ahead of presence, because presence is something we learned over a
  // connection we no longer have. Leaving "Online" up while our own socket is
  // dead states as fact the one thing we currently cannot know.
  if (disconnected) {
    return (
      <span className={`${row} text-muted-foreground`}>
        <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
        <span className="truncate">{t("waitingForConnection")}</span>
      </span>
    );
  }

  if (presence?.online) {
    return (
      <span className={`${row} text-muted-foreground`}>
        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="truncate">{t("online")}</span>
      </span>
    );
  }

  // null covers both "never been online" and a timestamp that will not parse -
  // the row then renders empty rather than "Last seen Invalid Date".
  const lastSeen = describeLastSeen(presence?.lastSeenAt);

  return (
    <span className={`${row} text-muted-foreground`}>
      {lastSeen && (
        <span className="truncate">
          {lastSeen.kind === "today"
            ? t("lastSeenToday", { time: formatChatTime(lastSeen.at) })
            : lastSeen.kind === "yesterday"
              ? t("lastSeenYesterday", { time: formatChatTime(lastSeen.at) })
              : t("lastSeenOn", { date: formatChatDate(lastSeen.at) })}
        </span>
      )}
    </span>
  );
}

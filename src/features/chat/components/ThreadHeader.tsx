"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChatStore } from "../store/chatStore";
import { useSelectionStore } from "../store/selectionStore";
import type { UserPresence } from "../types";
import { PresenceLine } from "./PresenceLine";
import { MessageActionBar } from "./MessageActionBar";
import { IconButton } from "@/components/IconButton";

interface Props {
  conversationId: string;
  name: string;
  presence: UserPresence | undefined;
  /** Name or presence still resolving - both lines show a skeleton. */
  profilesLoading: boolean;
  presenceLoading: boolean;
  /**
   * Renders the title. The drawer passes its `SheetTitle` so the dialog keeps
   * its accessible name; the page passes a plain heading.
   */
  renderTitle: (content: React.ReactNode) => React.ReactNode;
  /** Before the name - the drawer's back arrow. */
  leading?: React.ReactNode;
  /** At the end - the drawer's "open page" and close buttons. */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Leaves the open conversation for the inbox list. Goes in `leading` wherever
 * the list and the thread take turns on screen - the drawer, and the page
 * below `lg`. Not on a wide page: the list is already beside the thread, so
 * "back" would only empty the right column.
 */
export function BackToInboxButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations("chat");
  return (
    <IconButton label={t("backToInbox")} variant="ghost" size="icon-sm" onClick={onClick} className={cn("-ml-1", className)}>
      <ArrowLeft className="size-4" />
    </IconButton>
  );
}

/**
 * Who you are talking to and whether they are around. One header for the
 * drawer and the page; each surface adds its own controls through `leading`
 * and `trailing`.
 *
 * While a message is picked it becomes that message's action bar, as on
 * WhatsApp. Deleting the whole conversation no longer lives here: it is picked
 * in the inbox list instead (see InboxSelectionHeader).
 */
export function ThreadHeader({
  conversationId,
  name,
  presence,
  profilesLoading,
  presenceLoading,
  renderTitle,
  leading,
  trailing,
  className,
}: Props) {
  const t = useTranslations("chat");
  const connected = useChatStore((s) => s.connected);
  const pickedMessageId = useSelectionStore((s) =>
    s.selected?.kind === "message" && s.selected.conversationId === conversationId
      ? s.selected.messageId
      : null,
  );

  if (pickedMessageId) {
    return (
      <MessageActionBar
        className={className}
        conversationId={conversationId}
        messageId={pickedMessageId}
        renderTitle={renderTitle}
      />
    );
  }

  return (
    <div className={className}>
      {leading}
      {/* min-w-0 so the name can still truncate once it sits in a column */}
      <div className="flex flex-col min-w-0">
        {renderTitle(
          // `my-0.5`: the bar is a block, so without it the title line is
          // 16px instead of text-sm's 20px and the header text shifts 2px
          // when the name arrives.
          profilesLoading ? <Skeleton className="h-4 w-28 my-0.5" /> : name || t("conversation")
        )}
        <PresenceLine
          presence={presence}
          isLoading={profilesLoading || presenceLoading}
          disconnected={!connected}
        />
      </div>
      <div className="ml-auto flex items-center gap-0.5 shrink-0">{trailing}</div>
    </div>
  );
}

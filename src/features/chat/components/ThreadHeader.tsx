"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChatStore } from "../store/chatStore";
import { useDeleteConversation } from "../hooks/useDeleteConversation";
import type { UserPresence } from "../types";
import { PresenceLine } from "./PresenceLine";
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
  /** After the delete control - the drawer's "open page" and close buttons. */
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
 * Who you are talking to, whether they are around, and the delete control.
 * One header for the drawer and the page; each surface adds its own controls
 * through `leading` and `trailing`.
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
  const tCommon = useTranslations("common");
  const connected = useChatStore((s) => s.connected);
  const { deleteConversation, deleting } = useDeleteConversation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    // A success unmounts this header with the thread, taking the dialog with
    // it; a failure leaves the dialog open beside its toast.
    if (await deleteConversation(conversationId)) setDeleteDialogOpen(false);
  };

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
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <ActionButton
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t("deleteConversation")}
          description={t("deleteConversationDesc")}
          confirmText={t("delete")}
          loadingText={t("deleting")}
          cancelText={tCommon("cancel")}
          isLoading={deleting}
          onConfirm={() => void handleDelete()}
        >
          {/* Resting control - the dialog's confirm button carries the
              spinner. */}
          <IconButton label={t("deleteConversation")} variant="ghost" size="icon-sm">
            <Trash2 className="size-4 text-muted-foreground" />
          </IconButton>
        </ActionButton>
        {trailing}
      </div>
    </div>
  );
}

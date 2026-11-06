"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCheck, Loader2, MessageSquareDot, Trash2, X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { useConversationActions } from "../hooks/useConversationActions";
import { useConversations } from "../hooks/useConversations";
import { useChatStore } from "../store/chatStore";
import { useSelectionStore } from "../store/selectionStore";
import { DeleteConversationsDialog } from "./DeleteConversationsDialog";

/** Whether a conversation shows as unread: new messages, or "Mark as unread". */
export function isUnread(convUnread: Record<string, number>, conversation: { conversationId: string; markedUnread?: boolean }) {
  return (convUnread[conversation.conversationId] ?? 0) > 0 || !!conversation.markedUnread;
}

/**
 * The inbox header in selection mode, as on WhatsApp: a way out, how many are
 * picked, then what they allow - Mark as unread when every picked one is read,
 * Mark as read otherwise, and Delete. Deleting removes the conversations from
 * this user's inbox only; the other participant keeps them.
 *
 * Renders `children` - the surface's ordinary header - when nothing is picked,
 * so each surface keeps its own title and controls.
 */
export function InboxSelectionHeader({
  children,
  className,
  renderTitle = (content) => <span className="text-sm font-semibold">{content}</span>,
}: {
  children: React.ReactNode;
  className?: string;
  /** The drawer wraps the count in its SheetTitle, which a sheet always needs. */
  renderTitle?: (content: React.ReactNode) => React.ReactNode;
}) {
  const t = useTranslations("chat");
  const picked = useSelectionStore((s) => (s.selected?.kind === "conversations" ? s.selected.ids : null));
  const clear = useSelectionStore((s) => s.clear);
  const convUnread = useChatStore((s) => s.convUnread);
  const { data } = useConversations();
  const { deleteConversations, setReadState, pending } = useConversationActions();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Escape puts the header back, as the X does.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dialogOpen) clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, dialogOpen, clear]);

  if (!picked) return <>{children}</>;

  const pickedConversations = (data?.conversations ?? []).filter((c) => picked.includes(c.conversationId));
  const anyUnread = pickedConversations.some((c) => isUnread(convUnread, c));

  const handleDelete = async () => {
    // Success removes the rows and, with the selection cleared, this bar and
    // its dialog; a failure leaves the dialog open beside its toast.
    if (await deleteConversations(picked)) {
      setDialogOpen(false);
      clear();
    }
  };

  const handleReadState = async () => {
    if (await setReadState(picked, anyUnread)) clear();
  };

  const readLabel = anyUnread
    ? pending === "read" ? t("markingAsRead") : t("markAsRead")
    : pending === "unread" ? t("markingAsUnread") : t("markAsUnread");

  return (
    <div className={className}>
      {/* -ml-1, as the back arrow it stands in for (BackToInboxButton): the
          two swap in place, so icon and title must not jump sideways. */}
      <IconButton label={t("clearSelection")} variant="ghost" size="icon-sm" onClick={clear} className="-ml-1">
        <X className="size-4" />
      </IconButton>
      {renderTitle(t("selectedCount", { count: picked.length }))}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <IconButton
          label={readLabel}
          variant="ghost"
          size="icon-sm"
          disabled={pending !== null}
          onClick={() => void handleReadState()}
        >
          {pending === "read" || pending === "unread" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : anyUnread ? (
            <CheckCheck className="size-4" />
          ) : (
            <MessageSquareDot className="size-4" />
          )}
        </IconButton>
        <DeleteConversationsDialog
          count={picked.length}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          isLoading={pending === "delete"}
          onConfirm={() => void handleDelete()}
        >
          {/* Resting control - the dialog's confirm button carries the spinner. */}
          <IconButton label={t("deleteConversationAction")} variant="ghost" size="icon-sm" disabled={pending !== null}>
            <Trash2 className="size-4" />
          </IconButton>
        </DeleteConversationsDialog>
      </div>
    </div>
  );
}

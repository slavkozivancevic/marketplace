"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Pencil, Reply, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { IconButton } from "@/components/IconButton";
import { useMessages } from "../hooks/useMessages";
import { useSelectionStore } from "../store/selectionStore";
import type { UserProfile } from "../hooks/useUserProfiles";
import { useChatRuntime } from "./ChatRuntime";
import { formatCopy, selectionActions } from "../utils/messageOps";
import { chatDisplayName } from "../utils/displayName";
import { DeleteMessagesDialog } from "./DeleteMessagesDialog";

/**
 * The thread header in selection mode, as on WhatsApp: a way out, how many are
 * picked, then only what the selection allows its viewer right now - for one
 * message reply, copy, edit (own text, 15 minutes) and delete; for several
 * copy and delete. Reactions live on the message itself (the long press opens
 * the emoji bar over a single picked message).
 *
 * Edit and delete are on screen at once and roll back with a toast if the
 * server refuses (see useChatSocket), so the dialog never waits on it.
 */
export function MessageActionBar({
  conversationId,
  messageIds,
  profiles = {},
  className,
  renderTitle = (content) => <span className="text-sm font-semibold">{content}</span>,
}: {
  conversationId: string;
  messageIds: string[];
  /** For the names in a multi-message copy. */
  profiles?: Record<string, UserProfile>;
  className?: string;
  /** The drawer wraps the count in its SheetTitle, which a sheet always needs. */
  renderTitle?: (content: React.ReactNode) => React.ReactNode;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const runtime = useChatRuntime();
  const { data } = useMessages(conversationId);
  const clear = useSelectionStore((s) => s.clear);
  const startEdit = useSelectionStore((s) => s.startEdit);
  const startReply = useSelectionStore((s) => s.startReply);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Re-read on each render rather than kept: a selection left open across the
  // 15-minute mark must stop offering "edit".
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Escape clears, as the X does (the open dialog handles its own Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteOpen) clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear, deleteOpen]);

  const picked = (data?.messages ?? []).filter((m) => messageIds.includes(m.messageId));
  // Gone from under the selection (deleted elsewhere, conversation dropped).
  const lost = !!data && picked.length === 0;
  useEffect(() => {
    if (lost) clear();
  }, [lost, clear]);
  if (picked.length === 0 || !runtime) return null;

  const me = runtime.currentUserId;
  const allowed = selectionActions(picked, me, now);
  const single = picked.length === 1 ? picked[0] : null;

  const copy = async () => {
    const text = formatCopy(picked, (id) => chatDisplayName(profiles[id], t("deletedAccount")), locale);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copiedCount", { count: picked.filter((m) => !m.deletedAt && m.text.trim()).length }));
    } catch {
      toast.error(t("copyFailed"));
    }
    clear();
  };

  const remove = (scope: "everyone" | "me") => {
    setDeleteOpen(false);
    clear();
    runtime.deleteMessages(conversationId, picked, scope);
  };

  return (
    <div className={className}>
      {/* -ml-1, as the back arrow it stands in for (BackToInboxButton): the
          two swap in place, so icon and title must not jump sideways. */}
      <IconButton label={t("clearSelection")} variant="ghost" size="icon-sm" onClick={clear} className="-ml-1">
        <X className="size-4" />
      </IconButton>
      {renderTitle(t("selectedCount", { count: picked.length }))}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {allowed.reply && single && (
          <IconButton label={t("reply")} variant="ghost" size="icon-sm" onClick={() => startReply(conversationId, single)}>
            <Reply className="size-4" />
          </IconButton>
        )}
        {allowed.copy && (
          <IconButton label={t("copyMessage")} variant="ghost" size="icon-sm" onClick={() => void copy()}>
            <Copy className="size-4" />
          </IconButton>
        )}
        {allowed.edit && single && (
          <IconButton
            label={t("editMessage")}
            variant="ghost"
            size="icon-sm"
            onClick={() => startEdit(conversationId, single.messageId, single.text)}
          >
            <Pencil className="size-4" />
          </IconButton>
        )}
        <DeleteMessagesDialog
          count={picked.length}
          forEveryone={allowed.deleteForEveryone}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDelete={remove}
        >
          <IconButton label={t("deleteMessage")} variant="ghost" size="icon-sm">
            <Trash2 className="size-4" />
          </IconButton>
        </DeleteMessagesDialog>
      </div>
    </div>
  );
}

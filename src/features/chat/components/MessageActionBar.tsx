"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Pencil, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ActionButton";
import { IconButton } from "@/components/IconButton";
import { useMessages } from "../hooks/useMessages";
import { useSelectionStore } from "../store/selectionStore";
import { useChatRuntime } from "./ChatRuntime";
import { messageActions } from "../utils/messageOps";

/**
 * The thread header while a message is picked, as on WhatsApp: a way out,
 * then only what this message allows its viewer right now - copy, edit (own
 * text, 15 minutes), delete (for everyone: own, 60 hours; for me: always).
 * Reactions live on the message itself (the long press opens the emoji bar).
 *
 * Edit and delete are on screen at once and roll back with a toast if the
 * server refuses (see useChatSocket), so the dialog never waits on it.
 */
export function MessageActionBar({
  conversationId,
  messageId,
  className,
  renderTitle = (content) => <span className="text-sm font-semibold">{content}</span>,
}: {
  conversationId: string;
  messageId: string;
  className?: string;
  /** The drawer wraps the count in its SheetTitle, which a sheet always needs. */
  renderTitle?: (content: React.ReactNode) => React.ReactNode;
}) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const runtime = useChatRuntime();
  const { data } = useMessages(conversationId);
  const clear = useSelectionStore((s) => s.clear);
  const startEdit = useSelectionStore((s) => s.startEdit);
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

  const message = data?.messages.find((m) => m.messageId === messageId);
  // Gone from under the selection (deleted elsewhere, conversation dropped).
  useEffect(() => {
    if (data && !message) clear();
  }, [data, message, clear]);
  if (!message || !runtime) return null;

  const allowed = messageActions(message, runtime.currentUserId, now);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
    clear();
  };

  const remove = (scope: "everyone" | "me") => {
    setDeleteOpen(false);
    clear();
    runtime.deleteMessage(conversationId, message, scope);
  };

  return (
    <div className={className}>
      <IconButton label={t("clearSelection")} variant="ghost" size="icon-sm" onClick={clear}>
        <X className="size-4" />
      </IconButton>
      {renderTitle(t("selectedCount", { count: 1 }))}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {allowed.copy && (
          <IconButton label={t("copyMessage")} variant="ghost" size="icon-sm" onClick={() => void copy()}>
            <Copy className="size-4" />
          </IconButton>
        )}
        {allowed.edit && (
          <IconButton
            label={t("editMessage")}
            variant="ghost"
            size="icon-sm"
            onClick={() => startEdit(conversationId, messageId, message.text)}
          >
            <Pencil className="size-4" />
          </IconButton>
        )}
        {allowed.deleteForMe && (
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={t("deleteMessageTitle")}
            description={allowed.deleteForEveryone ? t("deleteMessageDescOwn") : t("deleteMessageDescOther")}
            confirmText={t("deleteForMe")}
            cancelText={tCommon("cancel")}
            isLoading={false}
            onConfirm={() => remove("me")}
            body={
              allowed.deleteForEveryone ? (
                <Button variant="destructive" className="w-full" onClick={() => remove("everyone")}>
                  {t("deleteForEveryone")}
                </Button>
              ) : undefined
            }
          >
            <IconButton label={t("deleteMessage")} variant="ghost" size="icon-sm">
              <Trash2 className="size-4" />
            </IconButton>
          </ConfirmDialog>
        )}
      </div>
    </div>
  );
}

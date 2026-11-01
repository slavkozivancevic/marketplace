"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { IconButton } from "@/components/IconButton";
import { useDeleteConversation } from "../hooks/useDeleteConversation";
import { useSelectionStore } from "../store/selectionStore";

/**
 * The inbox header while a conversation is picked (long press, right-click or
 * the row's chevron), as on WhatsApp: a way out, and delete. Deleting removes
 * the conversation from this user's inbox only; the other participant keeps
 * it, and a new message brings it back with only what came after.
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
  const tCommon = useTranslations("common");
  const picked = useSelectionStore((s) =>
    s.selected?.kind === "conversation" ? s.selected.conversationId : null,
  );
  const clear = useSelectionStore((s) => s.clear);
  const { deleteConversation, deleting } = useDeleteConversation();
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

  const handleDelete = async () => {
    // Success removes the row and, with the selection cleared, this bar and
    // its dialog; a failure leaves the dialog open beside its toast.
    if (await deleteConversation(picked)) {
      setDialogOpen(false);
      clear();
    }
  };

  return (
    <div className={className}>
      <IconButton label={t("clearSelection")} variant="ghost" size="icon-sm" onClick={clear}>
        <X className="size-4" />
      </IconButton>
      {renderTitle(t("selectedCount", { count: 1 }))}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <ActionButton
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={t("deleteConversation")}
          description={t("deleteConversationDesc")}
          confirmText={t("delete")}
          loadingText={t("deleting")}
          cancelText={tCommon("cancel")}
          isLoading={deleting}
          onConfirm={() => void handleDelete()}
        >
          {/* Resting control - the dialog's confirm button carries the spinner. */}
          <IconButton label={t("deleteConversationAction")} variant="ghost" size="icon-sm">
            <Trash2 className="size-4" />
          </IconButton>
        </ActionButton>
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ActionButton";

/**
 * "Delete N conversations?" - the one confirmation for deleting from the inbox,
 * whether it was opened from the selection header or from a row's menu. The
 * caller owns `open` and runs the delete (useConversationActions); a failure
 * leaves the dialog open beside its toast.
 */
export function DeleteConversationsDialog({
  count,
  open,
  onOpenChange,
  isLoading,
  onConfirm,
  children,
}: {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  onConfirm: () => void;
  /** The resting control that opens it, if any (the header's trash). */
  children?: React.ReactElement<{ disabled?: boolean }>;
}) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("deleteConversations", { count })}
      description={t("deleteConversationDesc")}
      confirmText={t("delete")}
      loadingText={t("deleting")}
      cancelText={tCommon("cancel")}
      isLoading={isLoading}
      onConfirm={onConfirm}
    >
      {children}
    </ConfirmDialog>
  );
}

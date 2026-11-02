"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ActionButton";

/**
 * "Delete N messages?" - one confirmation for the action bar and a bubble's
 * menu, as on WhatsApp: "Delete for me" always, "Delete for everyone" only
 * when every picked message allows it (`forEveryone`). The delete is on screen
 * at once and rolls back with a toast if the server refuses (useChatSocket),
 * so the dialog never waits on it: `onDelete` closes it.
 */
export function DeleteMessagesDialog({
  count,
  forEveryone,
  open,
  onOpenChange,
  onDelete,
  children,
}: {
  count: number;
  forEveryone: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (scope: "everyone" | "me") => void;
  /** The resting control that opens it, if any (the bar's trash). */
  children?: React.ReactElement<{ disabled?: boolean }>;
}) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("deleteMessagesTitle", { count })}
      description={forEveryone ? t("deleteMessageDescOwn") : t("deleteMessageDescOther")}
      confirmText={t("deleteForMe")}
      cancelText={tCommon("cancel")}
      isLoading={false}
      onConfirm={() => onDelete("me")}
      body={
        forEveryone ? (
          <Button variant="destructive" className="w-full" onClick={() => onDelete("everyone")}>
            {t("deleteForEveryone")}
          </Button>
        ) : undefined
      }
    >
      {children}
    </ConfirmDialog>
  );
}

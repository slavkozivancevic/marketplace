"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Copy, ListChecks, Pencil, Reply, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { IconButton } from "@/components/IconButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatMessage } from "../types";
import { selectionActions, type SelectionActions } from "../utils/messageOps";

/**
 * A bubble's menu with a mouse, as on WhatsApp Web: the chevron that shows on
 * hover (or keyboard focus) opens Reply, Copy, Edit, Delete - offered by the
 * same rules as the selection bar for one message - and Select, which enters
 * selection mode with it. Touch has no chevron; the held press, the swipe and
 * the header do the same there.
 */
export function MessageMenu({
  message,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onSelect,
}: {
  message: ChatMessage;
  currentUserId: string;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  // What the message allows is decided as the menu opens - "edit" must not
  // be offered once the 15 minutes are up.
  const [allowed, setAllowed] = useState<SelectionActions | null>(null);
  const onOpenChange = (next: boolean) => {
    if (next) setAllowed(selectionActions([message], currentUserId, Date.now()));
    setOpen(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={t("messageOptions")}
          variant="ghost"
          size="icon-sm"
          data-keep-selection
          className="mb-0.5 size-6 opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:hidden"
        >
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-keep-selection>
        {allowed?.reply && (
          <DropdownMenuItem onSelect={onReply}>
            <Reply />
            {t("reply")}
          </DropdownMenuItem>
        )}
        {allowed?.copy && (
          <DropdownMenuItem onSelect={() => void copy()}>
            <Copy />
            {t("copyMessage")}
          </DropdownMenuItem>
        )}
        {allowed?.edit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            {t("editMessage")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onSelect}>
          <ListChecks />
          {t("select")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          {t("deleteMessage")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { MessageCircle, ImageIcon, FileText, Video, Paperclip, Clock, Check, CheckCheck, Ban } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FallbackImg } from "@/components/FallbackImg";
import { Conversation } from "../types";
import { UserProfile } from "../hooks/useUserProfiles";
import { TypingPreview } from "./TypingIndicator";
import { ConversationListSkeleton } from "./MessagesPageSkeleton";
import { classifyDay, formatChatDate, formatChatTime } from "../utils/dateLabels";
import { useSelectGesture } from "../hooks/useSelectGesture";
import { useSelectionStore } from "../store/selectionStore";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  profiles: Record<string, UserProfile>;
  profilesLoading: boolean;
  convUnread: Record<string, number>;
  /** conversationId → userId → expiry. Only presence matters here. */
  typing: Record<string, Record<string, number>>;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isSearching?: boolean;
}

function getInitials(name: string | null | undefined, fallback: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return fallback.slice(0, 2).toUpperCase();
}

/** The badge shown when there is no picture, or the picture failed to load. */
function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold uppercase text-muted-foreground">
      {initials}
    </div>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  profiles,
  profilesLoading,
  convUnread,
  typing,
  onSelect,
  isLoading,
  isSearching = false,
}: Props) {
  const t = useTranslations("chat");

  /**
   * Timestamp on a row: the clock within today, then the thread's own wording
   * for yesterday, then the same date format the rest of the chat uses.
   *
   * Replaces `formatDistanceToNow(..., { addSuffix: false })`, which rendered
   * "about 22 hours" - no "ago", vague about past or future, and English even
   * in a Serbian UI.
   */
  const rowTimestamp = (at: Date) => {
    const kind = classifyDay(at);
    if (kind === "today") return formatChatTime(at);
    if (kind === "yesterday") return t("yesterday");
    return formatChatDate(at);
  };

  if (isLoading) return <ConversationListSkeleton />;

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <MessageCircle className="size-8 opacity-40" />
        <p className="text-sm">{isSearching ? t("noConversationsFound") : t("noConversationsYet")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {conversations.map((conv) => (
        <ConversationRow
          key={conv.conversationId}
          conv={conv}
          selectedId={selectedId}
          currentUserId={currentUserId}
          profiles={profiles}
          profilesLoading={profilesLoading}
          convUnread={convUnread}
          typing={typing}
          onSelect={onSelect}
          rowTimestamp={rowTimestamp}
        />
      ))}
    </div>
  );
}

type RowProps = Omit<Props, "conversations" | "isLoading" | "isSearching"> & {
  conv: Conversation;
  rowTimestamp: (at: Date) => string;
};

/**
 * One inbox row, as on WhatsApp. A tap opens the conversation; a long press
 * (touch), right-click or the hover menu's "Select" (mouse) enters selection
 * mode with it, and from then on a tap picks or un-picks rows instead of
 * opening them. A picked row carries a tick on its avatar.
 */
function ConversationRow({
  conv,
  selectedId,
  currentUserId,
  profiles,
  profilesLoading,
  convUnread,
  typing,
  onSelect,
  rowTimestamp,
}: RowProps) {
  const t = useTranslations("chat");
  const isPicked = useSelectionStore(
    (s) => s.selected?.kind === "conversations" && s.selected.ids.includes(conv.conversationId),
  );
  const selectionActive = useSelectionStore((s) => s.selected?.kind === "conversations");
  const selectConversation = useSelectionStore((s) => s.selectConversation);
  const toggleConversation = useSelectionStore((s) => s.toggleConversation);
  const clearSelection = useSelectionStore((s) => s.clear);
  const toggle = () => {
    if (!toggleConversation(conv.conversationId)) toast.error(t("selectionFull"));
  };
  const gesture = useSelectGesture(
    () => (selectionActive ? toggle() : selectConversation(conv.conversationId)),
    selectionActive ? toggle : null,
  );

  const otherId =
    conv.participants.find((p) => p !== currentUserId) ?? conv.participants[0];
  const profile = profiles[otherId];
  const profileLoading = profilesLoading;
  const displayName = profile?.name ?? "";
  const initials = getInitials(profile?.name, "");
  const isSelected = conv.conversationId === selectedId;
  const isTyping =
    Object.keys(typing[conv.conversationId] ?? {}).length > 0;
  const isMine = conv.lastMessageSenderId === currentUserId;
  const unread = convUnread[conv.conversationId] ?? 0;
  const attachType = conv.lastAttachmentType;
  const isLastMsgPending = conv.lastMessagePending === true;
  // One source: the conversation itself. The server fills this on every
  // fetch and live receipts update it in place, so there is nothing left
  // to disagree with it.
  const lastMsgReadBy = conv.lastMessageReadBy ?? [];
  const isLastMsgRead = lastMsgReadBy.some((id) => id !== currentUserId);
  const AttachIcon =
    attachType === "image" ? ImageIcon :
    attachType === "pdf" ? FileText :
    attachType === "video" ? Video :
    attachType === "file" ? Paperclip : null;

  // Show reaction preview if it's more recent than the last message
  const showReaction =
    !!conv.lastReactionPreview &&
    !!conv.lastReactionAt &&
    (!conv.lastMessageAt || conv.lastReactionAt > conv.lastMessageAt);
  const reactionActorName = conv.lastReactionUserId === currentUserId
    ? "You"
    : (profiles[conv.lastReactionUserId ?? ""]?.name?.split(" ")[0] ?? "");

  const avatar = profileLoading ? (
    <Skeleton className="size-9 rounded-full shrink-0" />
  ) : profile?.imageUrl ? (
    <FallbackImg
      src={profile.imageUrl}
      alt={displayName}
      className="size-9 rounded-full shrink-0 object-cover bg-muted"
      fallback={<InitialsAvatar initials={initials} />}
    />
  ) : (
    <InitialsAvatar initials={initials} />
  );

  return (
    <div className="group/row relative">
      <button
        {...gesture}
        onClick={() => {
          clearSelection();
          onSelect(conv.conversationId);
        }}
        aria-pressed={selectionActive ? isPicked : undefined}
        className={cn(
          // The touch callout and text selection would fight the long press.
          "flex items-center gap-3 rounded-lg p-3 text-left transition-colors cursor-pointer w-full [-webkit-touch-callout:none] pointer-coarse:select-none",
          isPicked
            ? "bg-primary/20 text-foreground"
            : isSelected
              ? "bg-primary/10 text-foreground"
              : "pointer-fine:hover:bg-muted/60"
        )}
      >
        {/* Avatar, with WhatsApp's tick at the bottom right while picked. */}
        <div className="relative shrink-0">
          {avatar}
          {isPicked && (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
              <Check className="size-2.5 text-white" strokeWidth={3} />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            {profileLoading ? (
              // The name's 20px line box with the list skeleton's bar in
              // it, so neither the row nor the bar changes when the list
              // skeleton hands over to rows still waiting on profiles.
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-24" />
              </div>
            ) : (
              <span className="text-sm font-medium truncate">{displayName}</span>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {conv.lastMessageAt && (
                <span className="text-[11px] text-muted-foreground">
                  {rowTimestamp(new Date(conv.lastMessageAt))}
                </span>
              )}
              {unread > 0 ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : conv.markedUnread ? (
                // "Mark as unread": a dot with no number, as on WhatsApp.
                <span className="size-2.5 rounded-full bg-primary">
                  <span className="sr-only">{t("markedUnread")}</span>
                </span>
              ) : null}
            </div>
          </div>
          {/* Typing outranks both previews - it is the newer fact, and it
              is what the row is telling you right now. */}
          {isTyping ? (
            <TypingPreview />
          ) : showReaction ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              <span className="truncate">
                {reactionActorName ? `${reactionActorName} ` : ""}{conv.lastReactionPreview}
              </span>
            </p>
          ) : conv.lastMessageDeleted ? (
            // Said in the viewer's own words, as on WhatsApp.
            <p className="text-xs text-muted-foreground italic truncate mt-0.5 flex items-center gap-1">
              <Ban className="size-3 shrink-0" />
              <span className="truncate">{isMine ? t("youDeletedThisMessage") : t("thisMessageWasDeleted")}</span>
            </p>
          ) : conv.lastMessagePreview ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              {isMine && (
                isLastMsgPending ? (
                  <Clock className="size-3 shrink-0" />
                ) : isLastMsgRead ? (
                  <CheckCheck className="size-3 shrink-0 text-sky-500" />
                ) : (
                  <Check className="size-3 shrink-0" />
                )
              )}
              {AttachIcon && <AttachIcon className="size-3 shrink-0" />}
              <span className="truncate">{conv.lastMessagePreview}</span>
            </p>
          ) : null}
        </div>
      </button>
      {/* No per-row menu: a right-click (or a held press on a phone) selects
          the row, and every action - read state, delete - is in the selection
          bar above the list, for one conversation or many. One place for
          them, as in the thread. */}
    </div>
  );
}
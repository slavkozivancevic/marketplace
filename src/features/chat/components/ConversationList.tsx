"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Conversation } from "../types";
import { UserProfile } from "../hooks/useUserProfiles";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  profiles: Record<string, UserProfile>;
  profilesLoading: boolean;
  convUnread: Record<string, number>;
  onSelect: (id: string) => void;
  isLoading: boolean;
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

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  profiles,
  profilesLoading,
  convUnread,
  onSelect,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <MessageCircle className="size-8 opacity-40" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {conversations.map((conv) => {
        const otherId =
          conv.participants.find((p) => p !== currentUserId) ?? conv.participants[0];
        const profile = profiles[otherId];
        const profileLoading = profilesLoading;
        const displayName = profile?.name ?? "";
        const initials = getInitials(profile?.name, "");
        const isSelected = conv.conversationId === selectedId;
        const isMine = conv.lastMessageSenderId === currentUserId;
        const unread = convUnread[conv.conversationId] ?? 0;

        return (
          <button
            key={conv.conversationId}
            onClick={() => onSelect(conv.conversationId)}
            className={cn(
              "flex items-center gap-3 rounded-lg p-3 text-left transition-colors cursor-pointer w-full",
              isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
            )}
          >
            {/* Avatar */}
            {profileLoading ? (
              <Skeleton className="size-9 rounded-full shrink-0" />
            ) : profile?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.imageUrl}
                alt={displayName}
                className="size-9 rounded-full shrink-0 object-cover"
              />
            ) : (
              <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold uppercase text-muted-foreground">
                {initials}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                {profileLoading ? (
                  <Skeleton className="h-3.5 w-24" />
                ) : (
                  <span className="text-sm font-medium truncate">{displayName}</span>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  {conv.lastMessageAt && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), {
                        addSuffix: false,
                      })}
                    </span>
                  )}
                  {unread > 0 && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
              </div>
              {conv.lastMessagePreview && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {isMine ? "You: " : ""}
                  {conv.lastMessagePreview}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
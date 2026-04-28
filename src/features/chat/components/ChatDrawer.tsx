"use client";

import { useEffect } from "react";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatStore } from "../store/chatStore";
import { useChatToken } from "../hooks/useChatToken";
import { useChatSocket } from "../hooks/useChatSocket";
import { unlockAudioContext } from "../utils/chatSounds";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";
import { useUserProfiles } from "../hooks/useUserProfiles";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";

/**
 * Trigger button rendered in the header — visible only when signed in.
 * Shows an unread badge when new messages arrive.
 */
export function ChatDrawerTrigger() {
  const { isSignedIn } = useUser();
  const openInbox = useChatStore((s) => s.openInbox);
  const unreadCount = useChatStore((s) => s.unreadCount);

  if (!isSignedIn) return null;

  return (
    <Button variant="outline" size="icon" onClick={openInbox} className="relative">
      <MessageCircle className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white pointer-events-none leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
      <span className="sr-only">Open messages</span>
    </Button>
  );
}

/**
 * Sheet panel — mount once in the layout so state persists across navigation.
 * The socket connection is established here (outside the Sheet) so messages
 * are received even when the drawer is closed.
 */
export function ChatDrawerRoot() {
  const { isSignedIn } = useUser();
  if (!isSignedIn) return null;
  return <ChatDrawerRootInner />;
}

function ChatDrawerRootInner() {
  const { data: tokenData } = useChatToken();
  const currentUserId = tokenData?.userId ?? "";
  // Socket lives here so it stays connected regardless of drawer open/close state
  const { sendMessage, markRead } = useChatSocket(tokenData?.token, currentUserId);
  const { isOpen, close } = useChatStore();

  // Unlock AudioContext on first user interaction so WebSocket-triggered sounds
  // can play even when the drawer is closed (no gesture at that moment).
  useEffect(() => {
    const unlock = () => {
      unlockAudioContext();
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <ChatDrawerInner
          currentUserId={currentUserId}
          sendMessage={sendMessage}
          markRead={markRead}
        />
      </SheetContent>
    </Sheet>
  );
}

interface InnerProps {
  currentUserId: string;
  sendMessage: (conversationId: string, text: string, attachments?: { key: string; type: string; width?: number; height?: number; filename?: string; size?: number }[]) => void;
  markRead: (conversationId: string, messageIds: string[]) => void;
}

function ChatDrawerInner({ currentUserId, sendMessage, markRead }: InnerProps) {
  const { selectedConvId, close, setSelectedConvId, convUnread, readStatus } = useChatStore();
  const queryClient = useQueryClient();

  const { data: convsData, isLoading: convsLoading } = useConversations();
  const { data: msgsData, isLoading: msgsLoading } = useMessages(selectedConvId);

  const conversations = convsData?.conversations ?? [];
  const messages = msgsData?.messages ?? [];

  // Collect every participant ID so we can resolve names
  const allParticipantIds = [...new Set(conversations.flatMap((c) => c.participants))];
  const { data: profiles = {}, isLoading: profilesLoading } = useUserProfiles(allParticipantIds);

  const selectedConv = conversations.find((c) => c.conversationId === selectedConvId);
  const otherParticipantId =
    selectedConv?.participants.find((p) => p !== currentUserId) ?? "";
  const otherParticipantName = profiles[otherParticipantId]?.name ?? "";

  // When opened to a specific conversation, ensure inbox is fresh
  useEffect(() => {
    if (selectedConvId) {
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    }
  }, [selectedConvId, queryClient]);

  const inThread = !!selectedConvId;

  return (
    <>
      <SheetHeader className="shrink-0 border-b px-4 py-3 flex-row items-center gap-2">
        {inThread && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSelectedConvId(null)}
            className="-ml-1"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <SheetTitle className="text-sm font-semibold truncate">
          {inThread
            ? profilesLoading
              ? <Skeleton className="h-4 w-28" />
              : otherParticipantName || "Conversation"
            : "Messages"}
        </SheetTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={close}
          className="ml-auto shrink-0"
        >
          ✕
        </Button>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-hidden">
        {inThread ? (
          <MessageThread
            conversationId={selectedConvId}
            messages={messages}
            currentUserId={currentUserId}
            isLoading={msgsLoading}
            profiles={profiles}
            onSend={(text, attachments) => sendMessage(selectedConvId!, text, attachments)}
            onMarkRead={(ids) => markRead(selectedConvId!, ids)}
          />
        ) : (
          <div className="overflow-y-auto h-full">
            <ConversationList
              conversations={conversations}
              selectedId={selectedConvId}
              currentUserId={currentUserId}
              profiles={profiles}
              profilesLoading={profilesLoading}
              convUnread={convUnread}
              readStatus={readStatus}
              onSelect={setSelectedConvId}
              isLoading={convsLoading}
            />
          </div>
        )}
      </div>
    </>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, ArrowLeft, Trash2, Loader2, X } from "lucide-react";
import { SearchInput } from "@/components/search/SearchInput";
import { SignedIn } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useConversationSearch } from "../hooks/useConversationSearch";
import { useUserProfiles } from "../hooks/useUserProfiles";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";

/**
 * Trigger button rendered in the header - visible only when signed in.
 * Shows an unread badge when new messages arrive.
 *
 * The combo `mounted`-guard + `<SignedIn>` is deliberate:
 *
 *   - `<SignedIn>` alone isn't enough on a cold dev start: server-side
 *     Clerk hasn't resolved the session cookie yet, so SSR renders nothing
 *     (signed-out path); meanwhile the client hydrates with the session
 *     already known, so it renders the button - and the position-shift in
 *     the header trips React's hydration check.
 *   - `mounted` keeps SSR and the FIRST client render aligned on `null`,
 *     and only after that initial render do we let `<SignedIn>` decide.
 *     By then Clerk is loaded on both sides and they agree.
 */
export function ChatDrawerTrigger() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <SignedIn>
      <ChatDrawerTriggerInner />
    </SignedIn>
  );
}

function ChatDrawerTriggerInner() {
  const isOpen = useChatStore((s) => s.isOpen);
  const openInbox = useChatStore((s) => s.openInbox);
  const closeInbox = useChatStore((s) => s.close);
  const unreadCount = useChatStore((s) => s.unreadCount);

  return (
    <Button variant="outline" size="icon" data-chat-trigger onClick={isOpen ? closeInbox : openInbox} className="relative">
      <MessageCircle className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
      <span className="sr-only">Open messages</span>
    </Button>
  );
}

/**
 * Sheet panel - mount once in the layout so state persists across navigation.
 * The socket connection is established here (outside the Sheet) so messages
 * are received even when the drawer is closed.
 *
 * Same `mounted` + `<SignedIn>` reasoning as `<ChatDrawerTrigger>` - the
 * sheet sits in the body and shifts the layout if SSR/hydration disagree,
 * so we hold off rendering until both sides agree on the session state.
 */
export function ChatDrawerRoot() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <SignedIn>
      <ChatDrawerRootInner />
    </SignedIn>
  );
}

function ChatDrawerRootInner() {
  const { data: tokenData } = useChatToken();
  const currentUserId = tokenData?.userId ?? "";
  // Socket lives here so it stays connected regardless of drawer open/close state
  const { sendMessage, markRead } = useChatSocket(tokenData?.token, currentUserId);
  const { isOpen, close, bootstrapUnread } = useChatStore();

  // Fetch conversations here (always mounted) so we can bootstrap unread
  // badges before the drawer is ever opened. React Query deduplicates this
  // with the same call inside ChatDrawerInner.
  const { data: convsData } = useConversations();
  const bootstrapConvs = useMemo(
    () => convsData?.conversations ?? [],
    [convsData?.conversations]
  );

  // Bootstrap unread badges from the initial conversations load - surfaces
  // messages that arrived while the user was offline. MUST run only once
  // per signed-in user: otherwise every WebSocket-driven conversations
  // cache update (e.g., a NEW_MESSAGE arriving) re-runs the loop and
  // increments unread for conversations the user is actively viewing.
  // Real-time unread is handled by the NEW_MESSAGE handler in useChatSocket.
  const bootstrappedForUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUserId || !bootstrapConvs.length) return;
    if (bootstrappedForUserRef.current === currentUserId) return;
    bootstrappedForUserRef.current = currentUserId;
    for (const conv of bootstrapConvs) {
      if (conv.lastMessageSenderId && conv.lastMessageSenderId !== currentUserId && conv.lastMessageAt) {
        bootstrapUnread(conv.conversationId, conv.lastMessageAt, conv.lastReadAt);
      }
    }
  }, [bootstrapConvs, currentUserId, bootstrapUnread]);

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
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        showCloseButton={false}
        aria-describedby={undefined}
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest("[data-chat-trigger]")) e.preventDefault();
        }}
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
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { selectedConvId, close, setSelectedConvId, convUnread, readStatus } = useChatStore();
  const queryClient = useQueryClient();

  const { data: convsData, isLoading: convsLoading } = useConversations();
  const { data: msgsData, isLoading: msgsLoading } = useMessages(selectedConvId);

  const conversations = useMemo(() => convsData?.conversations ?? [], [convsData?.conversations]);
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

  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConversation = async () => {
    if (!selectedConvId) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/chat/conversations/${selectedConvId}`);
      queryClient.setQueryData<{ conversations: typeof conversations }>(
        ["chat-conversations"],
        (old) => old
          ? { conversations: old.conversations.filter((c) => c.conversationId !== selectedConvId) }
          : old
      );
      void queryClient.removeQueries({ queryKey: ["chat-messages", selectedConvId] });
      void queryClient.removeQueries({ queryKey: ["conversation-search"] });
      setDeleteDialogOpen(false);
      setSelectedConvId(null);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (inThread) setSearch("");
  }, [inThread]);

  const { data: searchData } = useConversationSearch(search);

  const filteredConversations = search.trim()
    ? conversations.filter((conv) =>
        (searchData?.results ?? []).some((r) => r.conversationId === conv.conversationId)
      )
    : conversations;

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
              : otherParticipantName || t("conversation")
            : t("messages")}
        </SheetTitle>
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          {inThread && (
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => { if (!deleting) setDeleteDialogOpen(open); }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteConversation")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteConversationDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); void handleDeleteConversation(); }}
                    disabled={deleting}
                    variant="destructiveSolid"
                  >
                    {deleting ? <><Loader2 className="size-4 animate-spin" /> {t("deleting")}</> : t("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="icon-sm" onClick={close}>
            <X className="size-4" />
          </Button>
        </div>
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
          <div className="flex flex-col h-full">
            <div className="shrink-0 border-b px-3 py-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("searchPlaceholder")}
                className="pt-0 max-w-none"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              <ConversationList
                conversations={filteredConversations}
                selectedId={selectedConvId}
                currentUserId={currentUserId}
                profiles={profiles}
                profilesLoading={profilesLoading}
                convUnread={convUnread}
                readStatus={readStatus}
                onSelect={setSelectedConvId}
                isLoading={convsLoading}
                isSearching={!!search.trim()}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
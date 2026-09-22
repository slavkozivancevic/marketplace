"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, ArrowLeft, Trash2, X } from "lucide-react";
import { SearchInput } from "@/components/search/SearchInput";
import { SignedIn, useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ActionButton } from "@/components/ActionButton";
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
import { useTypingExpiry } from "../hooks/useTypingExpiry";
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
export function ChatDrawerTrigger({ signedIn = false }: { signedIn?: boolean }) {
  const { isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  // Until clerk-js settles its session, trust the server-resolved auth state
  // (`signedIn` prop) so the button ships in the SSR HTML under the boot
  // loader instead of popping in a beat after the loader lifts. Once Clerk is
  // loaded, <SignedIn> is authoritative again.
  if (mounted && isLoaded) {
    return (
      <SignedIn>
        <ChatDrawerTriggerInner />
      </SignedIn>
    );
  }
  // Pre-clerk: render a static button shell (no store read). The unread badge
  // is persisted client state (localStorage), so SSR-ing the real Inner - which
  // reads `unreadCount` - would mismatch (server 0 vs rehydrated client value).
  // The shell is identical on both sides; the real trigger + badge swap in
  // under the boot loader once Clerk is ready.
  return signedIn ? <ChatDrawerTriggerShell /> : null;
}

/**
 * Badge-less, store-free copy of the trigger button's markup. Used only during
 * the pre-clerk render window so the button occupies its slot under the boot
 * loader without risking a hydration mismatch on the persisted unread badge.
 */
function ChatDrawerTriggerShell() {
  const openInbox = useChatStore((s) => s.openInbox);
  return (
    <Button variant="outline" size="icon" data-chat-trigger onClick={openInbox} className="relative">
      <MessageCircle className="size-4" />
      <span className="sr-only">Open messages</span>
    </Button>
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
  const { sendMessage, sendTyping, markRead } = useChatSocket(tokenData?.token, currentUserId);
  const { isOpen, close, bootstrapUnread } = useChatStore();

  // Lives here, not in the drawer body: the inbox row's "typing..." has to
  // expire even while the drawer is closed.
  useTypingExpiry();

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
          sendTyping={sendTyping}
          markRead={markRead}
        />
      </SheetContent>
    </Sheet>
  );
}

interface InnerProps {
  currentUserId: string;
  sendMessage: (conversationId: string, text: string, attachments?: { key: string; type: string; width?: number; height?: number; filename?: string; size?: number }[]) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  markRead: (conversationId: string, messageIds: string[]) => void;
}

function ChatDrawerInner({ currentUserId, sendMessage, sendTyping, markRead }: InnerProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { selectedConvId, close, setSelectedConvId, convUnread, readStatus, typing } = useChatStore();
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

  const typingInSelected = useMemo(
    () => Object.keys(typing[selectedConvId ?? ""] ?? {}),
    [typing, selectedConvId]
  );

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
            <ActionButton
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              title={t("deleteConversation")}
              description={t("deleteConversationDesc")}
              confirmText={t("delete")}
              loadingText={t("deleting")}
              cancelText={tCommon("cancel")}
              isLoading={deleting}
              onConfirm={() => void handleDeleteConversation()}
            >
              {/* Resting control - the dialog's confirm button carries the
                  spinner. */}
              <Button variant="ghost" size="icon-sm">
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </ActionButton>
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
            typingUserIds={typingInSelected}
            onSend={(text, attachments) => sendMessage(selectedConvId!, text, attachments)}
            onMarkRead={(ids) => markRead(selectedConvId!, ids)}
            onTyping={sendTyping}
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
                typing={typing}
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
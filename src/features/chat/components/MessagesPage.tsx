"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { FloatingSidebarTrigger } from "@/components/layout/floating-sidebar-trigger";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useMobileBottomBarStore } from "@/store/mobileBottomBar";
import { useChatStore } from "../store/chatStore";
import { useChatThreadData } from "../hooks/useChatThreadData";
import { useIsWideLayout } from "../hooks/useIsWideLayout";
import { useUrlConversationId } from "../hooks/useUrlConversationId";
import { useChatRuntime, type ChatRuntime } from "./ChatRuntime";
import { InboxPanel } from "./InboxPanel";
import { MessageThread } from "./MessageThread";
import { MessagesPageSkeleton, NoConversationSelected } from "./MessagesPageSkeleton";
import { BackToInboxButton, ThreadHeader } from "./ThreadHeader";
import { MESSAGES_FRAME_CLASS, MESSAGES_HEADER_CLASS } from "./messagesLayout";

/**
 * The full-page inbox: conversations on the left, the open one on the right.
 * Below `lg` the inbox fills the page until a conversation is picked, then
 * moves into a left sheet behind the standard floating side-panel button.
 *
 * The connection is the app-wide one from `ChatRuntimeProvider`; until it is
 * up there is nothing to show, so the skeleton stands in.
 */
export function MessagesPage() {
  const runtime = useChatRuntime();
  if (!runtime) return <MessagesPageSkeleton />;
  return <MessagesPageInner runtime={runtime} />;
}

function MessagesPageInner({ runtime }: { runtime: ChatRuntime }) {
  const t = useTranslations("chat");
  const { currentUserId, sendMessage, sendTyping, markRead } = runtime;
  const isWide = useIsWideLayout();

  // The URL is the page's selection: back returns to the previous
  // conversation, and a reload or a shared link reopens the same one.
  const [urlConvId, setUrlConvId] = useUrlConversationId();
  const selectedConvId = useChatStore((s) => s.selectedConvId);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const data = useChatThreadData(selectedConvId, currentUserId);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Mounted = the drawer steps aside and the socket counts this page's
  // conversation as on screen. Leaving clears the selection.
  useEffect(() => {
    const { enterPage, leavePage } = useChatStore.getState();
    enterPage();
    return leavePage;
  }, []);

  // URL -> store. `setSelectedConvId` also clears the badge and records the
  // conversation as seen, exactly as a click in the drawer does. The ref is
  // updated first: the store write below notifies the subscriber further down
  // synchronously, and it must already see the new URL value or it would
  // write the same `c` back.
  const urlConvIdRef = useRef(urlConvId);
  useEffect(() => {
    urlConvIdRef.current = urlConvId;
    const { selectedConvId: current, setSelectedConvId } = useChatStore.getState();
    if (current !== urlConvId) setSelectedConvId(urlConvId);
  }, [urlConvId]);

  // Store -> URL, for the selection changes that start outside the page: a
  // delete (ours, or the other side's via the socket) drops the selection,
  // and the URL has to follow or the next render would put it back. Replace,
  // not push - back must not lead into a conversation that no longer exists.
  useEffect(
    () =>
      useChatStore.subscribe((s, prev) => {
        // Leaving the page clears the selection too, mid-navigation - writing
        // that into the URL would rewrite the address of the page we are
        // navigating to.
        if (!s.pageMounted) return;
        if (s.selectedConvId === prev.selectedConvId) return;
        if (s.selectedConvId === urlConvIdRef.current) return;
        setUrlConvId(s.selectedConvId, { replace: true });
      }),
    [setUrlConvId]
  );

  // A link to a conversation the user is not in (deleted, or never theirs)
  // falls back to the inbox. Only once the list is settled: a conversation
  // handed over from the drawer may be a refetch away from appearing.
  const unknownConversation =
    !!urlConvId &&
    data.convsLoaded &&
    !data.convsFetching &&
    !data.conversations.some((c) => c.conversationId === urlConvId);
  useEffect(() => {
    if (unknownConversation) setUrlConvId(null, { replace: true });
  }, [unknownConversation, setUrlConvId]);

  // Below `lg` the composer is a full-width footer, so the floating inbox
  // button has to clear it - the same contract an edit form's save bar uses.
  const threadIsBottomBar = !isWide && !!selectedConvId;
  useEffect(() => {
    if (!threadIsBottomBar) return;
    return useMobileBottomBarStore.getState().register();
  }, [threadIsBottomBar]);

  const selectConversation = (id: string) => {
    setSheetOpen(false);
    setUrlConvId(id);
  };

  const inbox = (
    <InboxPanel
      conversations={data.conversations}
      selectedId={selectedConvId}
      currentUserId={currentUserId}
      profiles={data.profiles}
      profilesLoading={data.profilesLoading}
      isLoading={data.convsLoading}
      onSelect={selectConversation}
    />
  );

  return (
    <div className={MESSAGES_FRAME_CLASS}>
      {/* Inbox column. Below `lg` it is the whole page until a conversation
          is open, then it steps into the sheet. */}
      <section
        className={cn(
          "w-full lg:w-80 shrink-0 flex-col lg:border-r",
          selectedConvId ? "hidden lg:flex" : "flex",
        )}
      >
        <div className={MESSAGES_HEADER_CLASS}>
          <h1 className="text-base font-semibold">{t("messages")}</h1>
        </div>
        <div className="flex-1 min-h-0">{inbox}</div>
      </section>

      {/* Thread column */}
      <section
        className={cn(
          "flex-1 min-w-0 flex-col",
          selectedConvId ? "flex" : "hidden lg:flex",
        )}
      >
        {selectedConvId ? (
          <>
            <ThreadHeader
              className={MESSAGES_HEADER_CLASS}
              conversationId={selectedConvId}
              name={data.otherParticipantName}
              presence={data.presence}
              profilesLoading={data.profilesLoading}
              presenceLoading={data.presenceLoading}
              renderTitle={(content) => (
                <h2 className="text-sm font-semibold truncate">{content}</h2>
              )}
              // Pushed like any other selection, so Back from the list returns
              // to the conversation just left.
              leading={
                <BackToInboxButton className="lg:hidden" onClick={() => setUrlConvId(null)} />
              }
            />
            <div className="flex-1 min-h-0 overflow-hidden">
              <MessageThread
                conversationId={selectedConvId}
                messages={data.messages}
                currentUserId={currentUserId}
                isLoading={data.msgsLoading}
                profiles={data.profiles}
                typingUserIds={data.typingInSelected}
                onSend={(text, attachments) => sendMessage(selectedConvId, text, attachments)}
                onMarkRead={(ids) => markRead(selectedConvId, ids)}
                onTyping={sendTyping}
                bottomInset
              />
            </div>
          </>
        ) : (
          <NoConversationSelected />
        )}
      </section>

      {/* Narrow-screen inbox, behind the standard side-panel button. Only
          while a conversation is open - otherwise the inbox is the page. */}
      {selectedConvId && (
        <div className="lg:hidden">
          <Sheet open={sheetOpen && !isWide} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <FloatingSidebarTrigger label={t("openInbox")}>
                <Inbox className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white pointer-events-none leading-none ring-2 ring-background">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </FloatingSidebarTrigger>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-80 flex flex-col p-0 gap-0"
              aria-describedby={undefined}
            >
              <div className={MESSAGES_HEADER_CLASS}>
                <SheetTitle className="text-base font-semibold">{t("messages")}</SheetTitle>
              </div>
              <div className="flex-1 min-h-0">{inbox}</div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}

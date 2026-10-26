"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, Maximize2, X } from "lucide-react";
import { SignedIn, useAuth } from "@clerk/nextjs";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChatStore } from "../store/chatStore";
import { useChatThreadData } from "../hooks/useChatThreadData";
import { useChatRuntime, type ChatRuntime } from "./ChatRuntime";
import { InboxPanel } from "./InboxPanel";
import { MessageThread } from "./MessageThread";
import { BackToInboxButton, ThreadHeader } from "./ThreadHeader";
import { IconButton } from "@/components/IconButton";

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
 * On `/messages` the trigger is a marker of where the user is, not a control:
 * the page already shows the inbox (and its own floating button opens it on a
 * narrow screen), so a click would have nothing to do. It stays in its slot -
 * hiding it would shift every icon beside it, and its badge still counts the
 * other conversations - rendered as an inert `aria-current="page"` element,
 * which the outline variant styles and strips of hover and press. A `<span>`
 * rather than a disabled button: no greyed-out look, no tab stop, and nothing
 * for a screen reader to call "dimmed".
 *
 * From the pathname rather than the store's `pageMounted`: the pathname is
 * the same on the server and the first client render, so the shell under the
 * boot loader is already highlighted and nothing flips once the page mounts.
 */
function useOnMessagesPage(): boolean {
  return usePathname() === "/messages";
}

/**
 * Badge-less, store-free copy of the trigger button's markup. Used only during
 * the pre-clerk render window so the button occupies its slot under the boot
 * loader without risking a hydration mismatch on the persisted unread badge.
 */
function ChatDrawerTriggerShell() {
  const t = useTranslations("chat");
  const openInbox = useChatStore((s) => s.openInbox);
  const onPage = useOnMessagesPage();
  const content = (
    <>
      <MessageCircle className="size-4" />
    </>
  );
  if (onPage) return <CurrentPageMarker label={t("openMessages")}>{content}</CurrentPageMarker>;
  return (
    <IconButton label={t("openMessages")} variant="outline" data-chat-trigger onClick={openInbox} className="relative">
      {content}
    </IconButton>
  );
}

/** The trigger's look, inert - see `useOnMessagesPage`. */
function CurrentPageMarker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <IconButton label={label} variant="outline" asChild className="relative">
      <span data-chat-trigger aria-current="page">
        {children}
      </span>
    </IconButton>
  );
}

function ChatDrawerTriggerInner() {
  const t = useTranslations("chat");
  const isOpen = useChatStore((s) => s.isOpen);
  const openInbox = useChatStore((s) => s.openInbox);
  const closeInbox = useChatStore((s) => s.close);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const onPage = useOnMessagesPage();

  const content = (
    <>
      <MessageCircle className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </>
  );
  if (onPage) return <CurrentPageMarker label={t("openMessages")}>{content}</CurrentPageMarker>;
  return (
    <IconButton label={t("openMessages")} variant="outline" data-chat-trigger onClick={isOpen ? closeInbox : openInbox} className="relative">
      {content}
    </IconButton>
  );
}

/**
 * Sheet panel - mount once in the layout so state persists across navigation.
 * The connection itself lives in `ChatRuntimeProvider`, so messages are
 * received whether this sheet is open or not, and the `/messages` page talks
 * through the same socket.
 */
export function ChatDrawerRoot() {
  const runtime = useChatRuntime();
  const isOpen = useChatStore((s) => s.isOpen);
  const close = useChatStore((s) => s.close);
  // No runtime means signed out (or not mounted yet) - same gate the old
  // `mounted` + `<SignedIn>` pair held, now owned by the provider.
  if (!runtime) return null;

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
        <ChatDrawerInner runtime={runtime} />
      </SheetContent>
    </Sheet>
  );
}

function ChatDrawerInner({ runtime }: { runtime: ChatRuntime }) {
  const t = useTranslations("chat");
  const { currentUserId, sendMessage, sendTyping, markRead } = runtime;
  const selectedConvId = useChatStore((s) => s.selectedConvId);
  const close = useChatStore((s) => s.close);
  const setSelectedConvId = useChatStore((s) => s.setSelectedConvId);
  const data = useChatThreadData(selectedConvId, currentUserId);

  const headerClass = "shrink-0 border-b px-4 py-3 flex-row items-center gap-2";

  // The way out to the full page. Carries the open conversation in the URL,
  // which the page reads as its selection. Object `href`: the string form
  // loses its query under the pathnames map.
  const toPage = (
    <IconButton label={t("openFullPage")} variant="ghost" size="icon-sm" asChild>
      <Link
        href={{
          pathname: "/messages",
          query: selectedConvId ? { c: selectedConvId } : undefined,
        }}
        onClick={close}
      >
        <Maximize2 className="size-4" />
      </Link>
    </IconButton>
  );
  const closeButton = (
    // Close X of a drawer header: an agreed exception to IconButton (CLAUDE.md,
    // "Icon-only buttons") - the symbol is the label.
    // eslint-disable-next-line no-restricted-syntax
    <Button variant="ghost" size="icon-sm" onClick={close}>
      <X className="size-4" />
      <span className="sr-only">{t("close")}</span>
    </Button>
  );

  return (
    <>
      {selectedConvId ? (
        <ThreadHeader
          className={`flex ${headerClass}`}
          conversationId={selectedConvId}
          name={data.otherParticipantName}
          presence={data.presence}
          profilesLoading={data.profilesLoading}
          presenceLoading={data.presenceLoading}
          renderTitle={(content) => (
            <SheetTitle className="text-sm font-semibold truncate">{content}</SheetTitle>
          )}
          leading={<BackToInboxButton onClick={() => setSelectedConvId(null)} />}
          trailing={<>{toPage}{closeButton}</>}
        />
      ) : (
        <SheetHeader className={headerClass}>
          <SheetTitle className="text-sm font-semibold truncate">{t("messages")}</SheetTitle>
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            {toPage}
            {closeButton}
          </div>
        </SheetHeader>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedConvId ? (
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
          />
        ) : (
          <InboxPanel
            conversations={data.conversations}
            selectedId={selectedConvId}
            currentUserId={currentUserId}
            profiles={data.profiles}
            profilesLoading={data.profilesLoading}
            isLoading={data.convsLoading}
            onSelect={setSelectedConvId}
          />
        )}
      </div>
    </>
  );
}

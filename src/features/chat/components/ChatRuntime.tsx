"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SignedIn, useAuth } from "@clerk/nextjs";
import { useChatStore } from "../store/chatStore";
import { useChatToken } from "../hooks/useChatToken";
import { useChatSocket } from "../hooks/useChatSocket";
import { useTypingExpiry } from "../hooks/useTypingExpiry";
import { useConversations } from "../hooks/useConversations";
import { unlockAudioContext } from "../utils/chatSounds";
import { useDemoReadOnly } from "@/features/demo/useDemoReadOnly";

type SendMessage = ReturnType<typeof useChatSocket>["sendMessage"];
type SendTyping = ReturnType<typeof useChatSocket>["sendTyping"];
type MarkRead = ReturnType<typeof useChatSocket>["markRead"];
type EditMessage = ReturnType<typeof useChatSocket>["editMessage"];
type DeleteMessage = ReturnType<typeof useChatSocket>["deleteMessage"];

/**
 * What a chat surface needs to talk to the socket. Both surfaces - the drawer
 * and the `/messages` page - read it from here, so there is only ever one
 * connection: a second one would deliver every message twice, drain the outbox
 * twice and chime twice.
 */
export interface ChatRuntime {
  currentUserId: string;
  sendMessage: SendMessage;
  sendTyping: SendTyping;
  markRead: MarkRead;
  editMessage: EditMessage;
  deleteMessage: DeleteMessage;
}

const ChatRuntimeContext = createContext<ChatRuntime | null>(null);

/** The live chat connection, or `null` while signed out or still mounting. */
export function useChatRuntime(): ChatRuntime | null {
  return useContext(ChatRuntimeContext);
}

/**
 * Owns the chat connection for the whole app and hands it to every surface
 * below it. `children` always render, on the server too - only the engine
 * waits for the client.
 */
export function ChatRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [runtime, setRuntime] = useState<ChatRuntime | null>(null);
  return (
    <ChatRuntimeContext.Provider value={runtime}>
      {children}
      <ChatRuntimeGate onRuntime={setRuntime} />
    </ChatRuntimeContext.Provider>
  );
}

/**
 * Same `mounted` + `<SignedIn>` reasoning as `<ChatDrawerTrigger>`: SSR and the
 * first client render agree on nothing, and only then does Clerk decide.
 */
function ChatRuntimeGate({ onRuntime }: { onRuntime: (r: ChatRuntime | null) => void }) {
  const [mounted, setMounted] = useState(false);
  // No engine for the demo seller and admin: the server refuses them a chat
  // token, and asking anyway would only put a 403 in the console.
  const demoReadOnly = useDemoReadOnly();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted || demoReadOnly) return null;
  return (
    <SignedIn>
      <ChatRuntimeEngine onRuntime={onRuntime} />
    </SignedIn>
  );
}

function ChatRuntimeEngine({ onRuntime }: { onRuntime: (r: ChatRuntime | null) => void }) {
  const { data: tokenData } = useChatToken();
  const currentUserId = tokenData?.userId ?? "";
  // Socket lives here so it stays connected whichever surface is open, or none
  const socket = useChatSocket(tokenData?.token, currentUserId);
  const bootstrapUnread = useChatStore((s) => s.bootstrapUnread);

  // The persisted counts belong to whoever collected them; a different
  // account signing in on this browser starts from zero. Layout effect: it
  // lands before the header badge paints with the previous owner's number.
  const { userId: clerkUserId } = useAuth();
  const claimFor = useChatStore((s) => s.claimFor);
  useLayoutEffect(() => {
    if (clerkUserId) claimFor(clerkUserId);
  }, [clerkUserId, claimFor]);

  // `useChatSocket` builds fresh functions on every render, and this component
  // renders on every socket frame. Publishing those directly would re-render
  // every consumer per frame, so the context carries stable wrappers that call
  // whatever the latest render produced.
  const latest = useRef(socket);
  useLayoutEffect(() => {
    latest.current = socket;
  });
  const runtime = useMemo<ChatRuntime>(
    () => ({
      currentUserId,
      sendMessage: (...args) => latest.current.sendMessage(...args),
      sendTyping: (...args) => latest.current.sendTyping(...args),
      markRead: (...args) => latest.current.markRead(...args),
      editMessage: (...args) => latest.current.editMessage(...args),
      deleteMessage: (...args) => latest.current.deleteMessage(...args),
    }),
    [currentUserId]
  );
  useEffect(() => {
    onRuntime(runtime);
    return () => onRuntime(null);
  }, [runtime, onRuntime]);

  // Lives here, not in a surface: the inbox row's "typing..." has to expire
  // even while nothing chat-related is on screen.
  useTypingExpiry();

  // Fetch conversations here (always mounted) so we can bootstrap unread
  // badges before any surface is ever opened. React Query deduplicates this
  // with the same call inside the surfaces.
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
  // can play even when no surface is open (no gesture at that moment).
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

  return null;
}

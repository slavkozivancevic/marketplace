"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/search/SearchInput";
import { useChatStore } from "../store/chatStore";
import { useConversationSearch } from "../hooks/useConversationSearch";
import type { Conversation } from "../types";
import type { UserProfile } from "../hooks/useUserProfiles";
import { ConversationList } from "./ConversationList";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  profiles: Record<string, UserProfile>;
  profilesLoading: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
}

/**
 * Search box over the conversation list - the inbox, wherever it is drawn:
 * the drawer's first screen, the page's left column, the page's narrow-screen
 * sheet. Search state is local, so each place starts with an empty box.
 */
export function InboxPanel({
  conversations,
  selectedId,
  currentUserId,
  profiles,
  profilesLoading,
  isLoading,
  onSelect,
}: Props) {
  const t = useTranslations("chat");
  const convUnread = useChatStore((s) => s.convUnread);
  const typing = useChatStore((s) => s.typing);
  const [search, setSearch] = useState("");
  const { data: searchData } = useConversationSearch(search);

  // Search finds what the list shows. A deleted account shows as "Deleted
  // account", so typing that (or part of it) finds it - never the name it
  // used to have, which the search service and its index no longer hold. The
  // label is matched here because it is this screen's wording, in this
  // locale; every other name is matched by the service.
  const q = search.trim().toLowerCase();
  const deletedLabelMatches = q.length > 0 && t("deletedAccount").toLowerCase().includes(q);
  const filteredConversations = q
    ? conversations.filter((conv) => {
        if ((searchData?.results ?? []).some((r) => r.conversationId === conv.conversationId)) return true;
        if (!deletedLabelMatches) return false;
        const otherId = conv.participants.find((p) => p !== currentUserId) ?? conv.participants[0];
        return profiles[otherId]?.deleted === true;
      })
    : conversations;

  return (
    <div className="flex flex-col h-full min-h-0">
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
          selectedId={selectedId}
          currentUserId={currentUserId}
          profiles={profiles}
          profilesLoading={profilesLoading}
          convUnread={convUnread}
          typing={typing}
          onSelect={onSelect}
          isLoading={isLoading}
          isSearching={!!search.trim()}
        />
      </div>
    </div>
  );
}

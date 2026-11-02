import { describe, it, expect } from "vitest";
import type { ChatMessage, Conversation } from "../types";
import { appendOlder, mergeNewestPage } from "./history";
import { withReadState } from "./messageOps";
import { quoteOf } from "./replies";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString();
const msg = (id: string, minute: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  messageId: id,
  conversationId: "c1",
  senderId: "them",
  text: `t ${id}`,
  attachments: [],
  readBy: [],
  createdAt: at(minute),
  ...extra,
});

describe("history paging", () => {
  it("puts an older page behind what is loaded, without duplicates, and moves the cursor", () => {
    const old = { messages: [msg("m3", 3), msg("m2", 2)], cursor: "c-2" };
    const page = { messages: [msg("m2", 2), msg("m1", 1)], cursor: "c-1" };
    expect(appendOlder(old, page)).toEqual({ messages: [msg("m3", 3), msg("m2", 2), msg("m1", 1)], cursor: "c-1" });
  });

  // A refetch of the newest page (focus, invalidation) must not throw away
  // history the reader scrolled up into.
  it("keeps loaded history, and its cursor, when the newest page is fetched again", () => {
    const cached = { messages: [msg("m3", 3), msg("m2", 2), msg("m1", 1)], cursor: "c-1" };
    const fresh = { messages: [msg("m4", 4), msg("m3", 3)], cursor: "c-3" };
    expect(mergeNewestPage(cached, fresh)).toEqual({
      messages: [msg("m4", 4), msg("m3", 3), msg("m2", 2), msg("m1", 1)],
      cursor: "c-1",
    });
  });

  it("takes the fresh page as it is when the conversation fits in it", () => {
    const fresh = { messages: [msg("m1", 1)] };
    expect(mergeNewestPage({ messages: [msg("m0", 0)] }, fresh)).toBe(fresh);
  });
});

describe("quoteOf - the local copy of a quote, as the server snapshots it", () => {
  it("keeps the first 120 characters and the first file only", () => {
    const long = "x".repeat(200);
    const q = quoteOf(msg("m1", 1, { text: long, attachments: [{ key: "k1", type: "image/png", filename: "a.png", size: 9 }, { key: "k2", type: "image/png" }] }));
    expect(q.excerpt).toHaveLength(120);
    expect(q.attachment).toEqual({ key: "k1", type: "image/png", filename: "a.png" });
  });

  it("a photo with no text has no excerpt", () => {
    expect(quoteOf(msg("m1", 1, { text: "", attachments: [{ key: "k", type: "image/jpeg" }] }))).not.toHaveProperty("excerpt");
  });
});

describe("withReadState", () => {
  const conv = (id: string): Conversation => ({ conversationId: id, participants: [], createdAt: at(0), lastMessageAt: at(5) });

  it("marks unread, and marking read moves the marker to the last message", () => {
    const data = { conversations: [conv("c1"), conv("c2")] };
    expect(withReadState(data, ["c1"], true)!.conversations[0].markedUnread).toBe(true);
    expect(withReadState(data, ["c1"], true)!.conversations[1].markedUnread).toBeUndefined();
    expect(withReadState(data, ["c2"], false)!.conversations[1]).toMatchObject({ markedUnread: false, lastReadAt: at(5) });
  });
});

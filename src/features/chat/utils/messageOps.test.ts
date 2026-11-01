import { describe, it, expect } from "vitest";
import type { ChatMessage, Conversation } from "../types";
import {
  DELETE_FOR_EVERYONE_WINDOW_MS,
  EDIT_WINDOW_MS,
  messageActions,
  withDelete,
  withEdit,
  withLastMessageChange,
} from "./messageOps";

const CREATED = "2026-11-01T10:00:00.000Z";
const T0 = Date.parse(CREATED);

const msg = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  messageId: "m1",
  conversationId: "c1",
  senderId: "me",
  text: "hello",
  attachments: [],
  readBy: [],
  createdAt: CREATED,
  ...extra,
});

describe("messageActions - what a picked message offers, as on WhatsApp", () => {
  it("own text message, fresh: everything", () => {
    expect(messageActions(msg(), "me", T0 + 60_000)).toEqual({
      copy: true,
      edit: true,
      deleteForEveryone: true,
      deleteForMe: true,
      react: true,
    });
  });

  it("edit ends at 15 minutes, delete for everyone at 60 hours, delete for me never", () => {
    expect(messageActions(msg(), "me", T0 + EDIT_WINDOW_MS).edit).toBe(true);
    expect(messageActions(msg(), "me", T0 + EDIT_WINDOW_MS + 1).edit).toBe(false);
    expect(messageActions(msg(), "me", T0 + DELETE_FOR_EVERYONE_WINDOW_MS).deleteForEveryone).toBe(true);
    const old = messageActions(msg(), "me", T0 + DELETE_FOR_EVERYONE_WINDOW_MS + 1);
    expect(old.deleteForEveryone).toBe(false);
    expect(old.deleteForMe).toBe(true);
    expect(old.copy).toBe(true);
  });

  it("someone else's message: copy, react and delete for me only", () => {
    expect(messageActions(msg({ senderId: "them" }), "me", T0)).toEqual({
      copy: true,
      edit: false,
      deleteForEveryone: false,
      deleteForMe: true,
      react: true,
    });
  });

  it("a photo without text cannot be copied or edited", () => {
    const a = messageActions(msg({ text: "", attachments: [{ key: "chat/me/x", type: "image/png" }] }), "me", T0);
    expect(a.copy).toBe(false);
    expect(a.edit).toBe(false);
    expect(a.deleteForEveryone).toBe(true);
  });

  it("a deleted message only offers clearing its placeholder away", () => {
    expect(messageActions(msg({ text: "", deletedAt: CREATED }), "me", T0)).toEqual({
      copy: false,
      edit: false,
      deleteForEveryone: false,
      deleteForMe: true,
      react: false,
    });
  });

  it("a message still in the outbox offers nothing", () => {
    expect(Object.values(messageActions(msg(), "me", T0, true)).some(Boolean)).toBe(false);
  });
});

describe("cache changes", () => {
  const thread = { messages: [msg(), msg({ messageId: "m0", text: "older" })] };

  it("an edit replaces the text and marks it edited", () => {
    const next = withEdit(thread, "m1", "fixed", "2026-11-01T10:05:00.000Z")!;
    expect(next.messages[0]).toMatchObject({ text: "fixed", editedAt: "2026-11-01T10:05:00.000Z" });
    expect(next.messages[1].text).toBe("older");
  });

  it("delete for everyone leaves a tombstone in place; delete for me removes it", () => {
    const withPhoto = { messages: [msg({ attachments: [{ key: "chat/me/x", type: "image/png" }] })] };
    const tomb = withDelete(withPhoto, "m1", "everyone", "2026-11-01T10:06:00.000Z")!;
    expect(tomb.messages[0]).toMatchObject({ text: "", attachments: [], deletedAt: "2026-11-01T10:06:00.000Z" });
    expect(withDelete(thread, "m1", "me", "x")!.messages.map((m) => m.messageId)).toEqual(["m0"]);
  });

  it("the inbox preview follows only when the changed message is the last one", () => {
    const conv = (lastMessageAt: string): Conversation => ({
      conversationId: "c1",
      participants: ["me", "them"],
      lastMessageAt,
      lastMessagePreview: "hello",
      createdAt: CREATED,
    });
    const last = { conversations: [conv(CREATED)] };
    expect(withLastMessageChange(last, "c1", CREATED, { text: "fixed" })!.conversations[0].lastMessagePreview).toBe("fixed");
    expect(withLastMessageChange(last, "c1", CREATED, { deleted: true })!.conversations[0]).toMatchObject({
      lastMessagePreview: "",
      lastMessageDeleted: true,
    });
    const newer = { conversations: [conv("2026-11-01T11:00:00.000Z")] };
    expect(withLastMessageChange(newer, "c1", CREATED, { text: "fixed" })!.conversations[0].lastMessagePreview).toBe("hello");
  });
});
